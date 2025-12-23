    function vvgglesht_openModal() {
      document.getElementById('vvgglesht_modal').style.display = 'block';
    }

    function vvgglesht_closeModal() {
      document.getElementById('vvgglesht_modal').style.display = 'none';
    }

    document.getElementById('vvgglesht_modal').onclick = function(event) {
      if (event.target === document.getElementById('vvgglesht_modal')) {
        vvgglesht_closeModal();
      }
    }