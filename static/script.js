  document.addEventListener('DOMContentLoaded', function() {
  const checkboxes = document.querySelectorAll('.page-checkbox');
  const renameButton = document.getElementById('renameButton');
  const editButton = document.getElementById('editButton');
  const deleteButton = document.getElementById('deleteButton');

  // Update the state of the global buttons.
  function updateButtons() {
    const checked = document.querySelectorAll('.page-checkbox:checked');
    const enable = (checked.length === 1);
    renameButton.disabled = !enable;
    editButton.disabled = !enable;
    deleteButton.disabled = !enable;
  }
  
  // Add event listeners for checkbox changes.
  checkboxes.forEach(chk => {
    chk.addEventListener('change', updateButtons);
  });
  
  // Rename button click: redirect to /rename?name=...
  renameButton.addEventListener('click', function() {
    const checked = document.querySelectorAll('.page-checkbox:checked');
    if (checked.length === 1) {
      const pageName = checked[0].getAttribute('data-id');
      window.location.href = "/rename?name=" + encodeURIComponent(pageName);
    }
  });
  
  // Edit button click: redirect to /edit?name=...
  editButton.addEventListener('click', function() {
    const checked = document.querySelectorAll('.page-checkbox:checked');
    if (checked.length === 1) {
      const pageName = checked[0].getAttribute('data-id');
      window.location.href = "/edit?name=" + encodeURIComponent(pageName);
    }
  });
  
  // Delete button click: confirm and redirect to /delete?name=...
  deleteButton.addEventListener('click', function() {
    const checked = document.querySelectorAll('.page-checkbox:checked');
    if (checked.length === 1) {
      const pageName = checked[0].getAttribute('data-id');
      if (confirm("Are you sure you want to delete '" + pageName + "'?")) {
        window.location.href = "/delete?name=" + encodeURIComponent(pageName);
      }
    }
  });
});