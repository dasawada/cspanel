document.addEventListener('DOMContentLoaded', () => {
  const hostnameElem = document.getElementById('ip_hostname');
  const orgElem = document.getElementById('ip_org');

  function addHotspotTag() {
    const hostname = hostnameElem.textContent || '';
    if (/mobile|emome/i.test(hostname) && !orgElem.querySelector('.mobile-hotspot-tag')) {
      const tag = document.createElement('span');
      tag.className = 'mobile-hotspot-tag';
      Object.assign(tag.style, {
        color: '#fff',
        backgroundColor: 'rgb(61, 145, 200)',
        border: '1px solid rgb(46, 89, 114)',
        fontWeight: 'bold',
        padding: '0px 4px',
        marginLeft: '8px',
        fontSize: '10px',
        borderRadius: '4px',
        display: 'inline-block'
      });
      tag.textContent = '手機熱點';
      orgElem.appendChild(tag);
    }
  }

  // 1. 監聽 hostname 文字變化
  const observer = new MutationObserver(addHotspotTag);
  observer.observe(hostnameElem, { childList: true, characterData: true, subtree: true });

  // 2. 初始化檢查一次
  addHotspotTag();
});
