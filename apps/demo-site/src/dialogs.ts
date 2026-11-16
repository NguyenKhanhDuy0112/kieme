import { $, initPage } from './common';

void initPage();

const result = $('#dialog-result');
const popupStatus = $('#popup-status');

$('#btn-alert').addEventListener('click', () => {
  alert('Đây là thông báo từ Kiemi Demo');
  result.textContent = 'Đã đóng thông báo';
});
$('#btn-confirm').addEventListener('click', () => {
  result.textContent = confirm('Bạn có chắc muốn tiếp tục?') ? 'Đã đồng ý' : 'Đã hủy';
});
$('#btn-prompt').addEventListener('click', () => {
  const name = prompt('Nhập tên của bạn', '');
  result.textContent = name === null ? 'Đã hủy nhập' : `Xin chào, ${name || 'bạn'}!`;
});
$('#btn-popup').addEventListener('click', () => {
  const win = window.open('/popup.html', 'kiemi-popup', 'width=480,height=360');
  popupStatus.textContent = win ? 'Đang mở' : 'Bị chặn';
});

// popup.html posts this message when its "Đóng" button is clicked.
window.addEventListener('message', (e) => {
  if (e.origin === location.origin && e.data === 'popup-closed')
    popupStatus.textContent = 'Đã đóng';
});
