// SubtypeManager：集中管理各大分類子分類邏輯
(function() {
  const SubtypeManager = {
    config: {
      '考卷/作業相關': {
        enabled: true,
        requireSelection: true,
        parentTagPattern: /^\[課程[^[\]]*\]\s*|\[教材講解\]\s*/,
        adminTagPattern: /^已查課表、並轉傳綠Line，老師：[^：]*：?\s*/,
        subTypes: [
          { value: '', label: '請選擇子分類', desc: '', parentTag: '', adminTag: '' },
          { value: '_empty', label: '', desc: '', parentTag: '', adminTag: '' }, // 新增空選項
          { value: '考卷檢討', label: '考卷檢討', desc: '查看學員課表找到該科目老師，綠色頻道轉傳後回覆家長', parentTag: '[課程考卷檢討] ', adminTag: '已查課表、並轉傳綠Line，老師：' },
          { value: '作業檢討', label: '作業檢討', desc: '查看學員課表找到該科目老師，綠色頻道轉傳後回覆家長', parentTag: '[課程作業檢討] ', adminTag: '已查課表、並轉傳綠Line，老師：' },
          { value: '教材講解', label: '教材講解', desc: '查看學員課表找到該科目老師，綠色頻道轉傳後回覆家長\n＊客制教材轉輔導', parentTag: '[教材講解] ', adminTag: '' }
        ]
      },
      '課程通訊問題': {
        enabled: true,
        requireSelection: true,
        parentTagPattern: /^\[教材錯誤\]\s*|^\[老師曠課\]\s*|\[課程[^[\]]*\]\s*|\[教材講解\]\s*/,
        adminTagPattern: /^老師One客服反映:|^老師曠課，致電 通均響底未接，已於 : 請學生下課，再麻煩輔導協助安排補課事宜。?/,
        subTypes: [
          { value: '', label: '請選擇子分類', desc: '', parentTag: '', adminTag: '' },
          { value: '_empty', label: '', desc: '', parentTag: '', adminTag: '' }, // 新增空選項
          { value: '教材錯誤', label: '教材錯誤', parentTag: '[教材錯誤] ', adminTag: '老師One客服反映:' },
          { value: '老師曠課', label: '老師曠課', parentTag: '[老師曠課] ', adminTag: '老師曠課，致電 通均響底未接，已於 : 請學生下課，再麻煩輔導協助安排補課事宜。' }
        ]
      }
      // 未來在此新增新分類即可
    },

    isEnabled(cat) { return !!this.config[cat]?.enabled; },
    requiresSelection(cat) { return !!this.config[cat]?.requireSelection; },
    getConfig(cat) { return this.config[cat]; },
    cleanup(cat, localData) {
      const cfg = this.getConfig(cat);
      if (!cfg) return;
      const parent = document.getElementById('bx-issue-parent-need');
      const admin = document.getElementById('bx-issue-admin-status');
      if (parent && cfg.parentTagPattern) {
        parent.value = parent.value.replace(cfg.parentTagPattern, '');
        localData.parentNeed = parent.value;
      }
      if (admin && cfg.adminTagPattern) {
        admin.value = admin.value.replace(cfg.adminTagPattern, '');
        localData.adminStatus = admin.value;
      }
      const sc = document.getElementById('bx-subtype-container');
      if (sc) sc.style.display = 'none';
      delete localData.subType;
    },

    insertTag({ textarea, newTag, pattern }) {
      if (!textarea) return;
      const cur = textarea.value;
      if (pattern && pattern.test(cur)) {
        textarea.value = newTag + cur.replace(pattern, '');
      } else {
        textarea.value = newTag + cur;
      }
    },

    render(category, host, localData) {
      const cfg = this.getConfig(category);
      if (!cfg) return;
      host.innerHTML = '';

      const sc = document.getElementById('bx-subtype-container');
      if (sc) {
        sc.style.display = 'flex';
        sc.innerHTML = '';
      }

      const select = document.createElement('select');
      select.id = 'bx-subtype-select';
      Object.assign(select.style, {
        width: '130px', fontSize: '13px', borderRadius: '8px',
        border: '1px solid #b7b7e7', padding: '4px 10px',
        background: '#fff', color: '#3a3366', outline: 'none',
        transition: 'all .25s'
      });

      // 在 render 方法中，forEach 時跳過 value: '' 的那個不可選選項
      cfg.subTypes.forEach(st => {
        if (st.value === '') return; // 跳過不可選
        const o = document.createElement('option');
        o.value = st.value;
        o.textContent = st.label;
        if (st.value === '_empty') o.style.color = '#999'; // 空白選項顯示灰色
        select.appendChild(o);
      });
      if (localData.subType) select.value = localData.subType;
      sc && sc.appendChild(select);

      const descDiv = document.createElement('div');
      Object.assign(descDiv.style, {
        margin: '4px 0', whiteSpace: 'pre-line', fontSize: '13px',
        color: '#b47d00', minHeight: '0', transition: 'all .2s'
      });
      host.appendChild(descDiv);

      const styleState = empty => {
        if (empty) {
          Object.assign(select.style, {
            color: '#999', background: '#fff5f5',
            borderColor: '#ffb3b3', boxShadow: '0 0 8px rgba(255,179,179,.3)'
          });
        } else {
            Object.assign(select.style, {
            color: '#3a3366', background: '#fff',
            borderColor: '#b7b7e7', boxShadow: 'none'
          });
        }
      };
      const setDesc = txt => {
        if (txt && txt.trim()) {
          Object.assign(descDiv.style, {
            background: '#fffbf0', padding: '6px 8px',
            borderRadius: '4px', border: '1px solid #f0e68c'
          });
          descDiv.textContent = txt;
        } else {
          Object.assign(descDiv.style, {
            background: 'transparent', padding: '0',
            borderRadius: '0', border: 'none'
          });
          descDiv.textContent = '';
        }
      };

      styleState(!localData.subType);
      if (localData.subType) {
        const cur = cfg.subTypes.find(s => s.value === localData.subType);
        if (cur) setDesc(cur.desc);
      }

      select.onchange = () => {
        const val = select.value;
        const sub = cfg.subTypes.find(s => s.value === val);
        localData.subType = sub ? sub.value : '';
        const parent = document.getElementById('bx-issue-parent-need');
        const admin = document.getElementById('bx-issue-admin-status');

        if (!sub || !val) {
          if (parent && cfg.parentTagPattern) {
            parent.value = parent.value.replace(cfg.parentTagPattern, '');
            localData.parentNeed = parent.value;
          }
          if (admin && cfg.adminTagPattern) {
            admin.value = admin.value.replace(cfg.adminTagPattern, '');
            localData.adminStatus = admin.value;
          }
          setDesc('');
          styleState(true);
          return;
        }

        if (sub.parentTag !== undefined) {
          this.insertTag({ textarea: parent, newTag: sub.parentTag, pattern: cfg.parentTagPattern });
          localData.parentNeed = parent.value;
        }
        if (cfg.adminTagPattern && sub.adminTag !== undefined) {
          this.insertTag({ textarea: admin, newTag: sub.adminTag, pattern: cfg.adminTagPattern });
          localData.adminStatus = admin.value;
        }
        setDesc(sub.desc);
        styleState(false);
      };
    },

    validateBeforeCopy(localData) {
      const cfg = this.getConfig(localData.selectedType);
      if (!cfg) return { ok: true };
      // 只排除空字串，_empty 也算通過
      if (cfg.requireSelection && (localData.subType === '')) {
        return { ok: false, focusEl: document.getElementById('bx-subtype-select') };
      }
      return { ok: true };
    }
  };

  if (typeof window !== 'undefined') window.SubtypeManager = SubtypeManager;
})();