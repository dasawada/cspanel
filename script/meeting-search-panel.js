    document.querySelectorAll('nav a').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove 'active' class from all content sections and nav links
            document.querySelectorAll('.meeting-menu-content-section').forEach(section => {
                section.classList.remove('active');
            });
            document.querySelectorAll('nav a').forEach(link => {
                link.classList.remove('active');
            });

            // Get the target section id from the clicked menu item
            const target = this.getAttribute('data-target');
            
            // Add 'active' class to the corresponding section and nav link
            document.getElementById(target).classList.add('active');
            this.classList.add('active');
        });
    });