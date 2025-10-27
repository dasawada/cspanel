export default async (request, context) => {
    // 設定 CORS header
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '86400'
    };
  
    // 處理預檢請求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }
  
    const ems = Deno.env.get('ems'); // Bitrix24 webhook base url
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!ems || !id) {
      return new Response(JSON.stringify({ error: '缺少參數' }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  
    // Helper: call Bitrix24 API
    async function bx(method, params) {
      const baseUrl = ems.replace(/\/+$/, '');
      const url = `${baseUrl}/${method}?${new URLSearchParams(params)}`;
      const res = await fetch(url);
      let data = {};
      try { data = await res.json(); } catch {}
      if (!res.ok || data.error) throw new Error(data.error_description || data.error || 'HTTP ' + res.status);
      return data;
    }
  
    // Helper: 判斷 open/closed
    const statusOf = ed1 => (ed1?.split('|')[5] === '0' ? 'closed' : 'open');
  
    try {
      const allChats = {};
      const collectedChatIds = new Set();
  
      const addChatToCollections = (chatId, connectorTitle = null) => {
        if (chatId !== null && chatId !== undefined) {
          const strChatId = String(chatId);
          collectedChatIds.add(strChatId);
          if (connectorTitle || !allChats[strChatId]) {
            allChats[strChatId] = { connector: connectorTitle || (allChats[strChatId] ? allChats[strChatId].connector : null) };
          }
        }
      };
  
      // 1. 取得 CONTACT 相關 chat
      try {
        const primaryChatsCall = await bx('imopenlines.crm.chat.get.json', {
          CRM_ENTITY_TYPE: 'CONTACT',
          CRM_ENTITY: id,
          ACTIVE_ONLY: 'N',
        });
        const primaryChatResults = Array.isArray(primaryChatsCall.result) ? primaryChatsCall.result : (primaryChatsCall.result ? [primaryChatsCall.result] : []);
        if (primaryChatResults.length > 0) {
          for (const chat of primaryChatResults) {
            addChatToCollections(chat.CHAT_ID, chat.CONNECTOR_TITLE);
          }
        } else {
          const lastIdData = await bx('imopenlines.crm.chat.getLastId.json', {
            CRM_ENTITY_TYPE: 'CONTACT',
            CRM_ENTITY: id,
          });
          if (lastIdData.result) addChatToCollections(lastIdData.result);
        }
      } catch (e) {
        try {
          const lastIdData = await bx('imopenlines.crm.chat.getLastId.json', {
            CRM_ENTITY_TYPE: 'CONTACT',
            CRM_ENTITY: id,
          });
          if (lastIdData.result) addChatToCollections(lastIdData.result);
        } catch {}
      }
  
      // 2. 取得關聯 LEAD/DEAL chat
      // LEAD
      try {
        const linkedLeads = await bx('crm.lead.list.json', {
          filter: { CONTACT_ID: id, CHECK_PERMISSIONS: 'N' },
          select: ['ID']
        });
        if (linkedLeads.result && linkedLeads.result.length > 0) {
          for (const lead of linkedLeads.result) {
            try {
              const leadChats = await bx('imopenlines.crm.chat.get.json', {
                CRM_ENTITY_TYPE: 'LEAD', CRM_ENTITY: lead.ID, ACTIVE_ONLY: 'N',
              });
              const leadChatResults = Array.isArray(leadChats.result) ? leadChats.result : (leadChats.result ? [leadChats.result] : []);
              if (leadChatResults.length > 0) {
                for (const chat of leadChatResults) {
                  addChatToCollections(chat.CHAT_ID, chat.CONNECTOR_TITLE);
                }
              } else {
                const lastLeadChat = await bx('imopenlines.crm.chat.getLastId.json', {
                  CRM_ENTITY_TYPE: 'LEAD', CRM_ENTITY: lead.ID,
                });
                if (lastLeadChat.result) addChatToCollections(lastLeadChat.result);
              }
            } catch {}
          }
        }
      } catch {}
  
      // DEAL
      try {
        const linkedDeals = await bx('crm.deal.list.json', {
          filter: { CONTACT_ID: id, CHECK_PERMISSIONS: 'N' },
          select: ['CONTACT_ID', 'ID']
        });
        if (linkedDeals.result && linkedDeals.result.length > 0) {
          for (const deal of linkedDeals.result) {
            try {
              const dealChats = await bx('imopenlines.crm.chat.get.json', {
                CRM_ENTITY_TYPE: 'DEAL', CRM_ENTITY: deal.ID, ACTIVE_ONLY: 'N',
              });
              const dealChatResults = Array.isArray(dealChats.result) ? dealChats.result : (dealChats.result ? [dealChats.result] : []);
              if (dealChatResults.length > 0) {
                for (const chat of dealChatResults) {
                  addChatToCollections(chat.CHAT_ID, chat.CONNECTOR_TITLE);
                }
              } else {
                const lastDealChat = await bx('imopenlines.crm.chat.getLastId.json', {
                  CRM_ENTITY_TYPE: 'DEAL', CRM_ENTITY: deal.ID,
                });
                if (lastDealChat.result) addChatToCollections(lastDealChat.result);
              }
            } catch {}
          }
        }
      } catch {}
  
      // 3. 整理 chat 資訊
      const chatIds = Array.from(collectedChatIds);
      if (!chatIds.length) {
        return new Response(JSON.stringify({ chats: [], portal: null }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
  
      // 取得 portal 網域
      const portalMatch = ems.match(/^https?:\/\/[^/]+/);
      const portal = portalMatch ? portalMatch[0] : '';
  
      // 取得 chat 詳細資訊
      const chats = [];
      for (let i = 0; i < chatIds.length; i++) {
        const cid = chatIds[i];
        let r = {};
        try {
          const dialogData = await bx('im.dialog.get.json', { DIALOG_ID: 'chat' + cid });
          r = dialogData.result || {};
        } catch {}
        // 過濾掉 entity_id 以 "|0" 結尾的聊天
        if (r.entity_id && r.entity_id.endsWith('|0')) {
          continue;
        }
        let title = r.TITLE || r.title || r.name || (allChats[cid] && allChats[cid].connector) || '未知';
        title = title.replace('- OneClass體驗接待大廳', '');
        const status = statusOf(r.entity_data_1);
        chats.push({ id: cid, title, status });
      }
  
      return new Response(JSON.stringify({ chats, portal }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  };