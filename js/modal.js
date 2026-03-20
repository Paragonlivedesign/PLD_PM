/* ============================================
   Module: Modal, Toast, Confirm
   Depends on: none
   ============================================ */

function initModal() {
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });
}

function openModal(title, bodyHTML, footerHTML) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  document.getElementById('modalFooter').innerHTML = footerHTML || '';
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  document.getElementById('modal').classList.remove('modal-wide');
}

// ============================================
// Toast
// ============================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 300ms ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// Confirmation Dialog
// ============================================
function showConfirm(title, message, onConfirm) {
  openModal(title, `<p style="font-size:14px;color:var(--text-secondary);line-height:1.6;">${message}</p>`, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-danger" onclick="closeModal(); (${onConfirm.toString()})();">Confirm</button>
  `);
}
