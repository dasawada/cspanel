// 分段滑塊 tab 詞彙的消費者共用 util（十一期回饋輪 3）。
// 視覺歸 style/v2/segtab.css；本檔只供「thumb 量測」——詞彙契約載明 thumb 位置
// 由消費者量測 active 分頁的 offsetLeft/offsetWidth 寫入 CSS 變數，滑移動畫由
// 詞彙的 transition 供給。offsetLeft 與 absolute left 同以 padding box 為原點，
// 量測值可直接互換。
//
// activeSelector：消費者的「作用中分頁」selector（wm 用 '.wm-tab.is-active'、
// 會議 strip 用 '.gl-segtab__tab.is-active'）。animate=false（重建/首繪）時暫停
// transition 直落——避免「從 0 滑進來」的假動畫；強制 reflow 後恢復，下次切換
// 即有滑移。
export function positionSegThumb(bar, activeSelector, animate) {
  if (!bar) return;
  const thumb = bar.querySelector('.gl-segtab__thumb');
  const active = bar.querySelector(activeSelector);
  if (!thumb || !active) return;
  if (!animate) thumb.style.transition = 'none';
  bar.style.setProperty('--segtab-thumb-x', `${active.offsetLeft}px`);
  bar.style.setProperty('--segtab-thumb-w', `${active.offsetWidth}px`);
  if (!animate) {
    thumb.offsetWidth; // eslint-disable-line no-unused-expressions -- 強制 reflow 讓直落生效
    thumb.style.transition = '';
  }
}
