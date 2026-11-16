/**
 * Vietnamese — the source of truth for every UI string.
 * Add keys here first; `en.ts` is type-checked to have exactly the same keys.
 * Keep wording friendly for non-coders (CLAUDE.md §5.8, SPEC U-05).
 */
import { viUi } from './vi-ui';

export const vi = {
  ui: viUi,
  app: {
    name: 'Kiemi',
    slogan: 'Bấm một lần, kiểm mãi mãi.',
    version: 'Phiên bản {{version}}',
  },
  common: {
    run: 'Chạy',
    record: 'Ghi lại',
    save: 'Lưu',
    cancel: 'Hủy',
    undo: 'Hoàn tác',
    loading: 'Đang tải…',
  },
  errors: {
    stepPrefix: 'Bước {{step}}: {{message}}',
    element: {
      generic: 'phần tử cần tìm',
      named: '“{{name}}”',
      role: '{{role}} “{{name}}”',
      roleOnly: '{{role}}',
      label: 'ô “{{value}}”',
      placeholder: 'ô “{{value}}”',
      text: 'chữ “{{value}}”',
    },
    roles: {
      button: 'nút',
      link: 'liên kết',
      textbox: 'ô nhập',
      checkbox: 'ô tick',
      radio: 'lựa chọn',
      combobox: 'danh sách chọn',
      option: 'mục chọn',
      heading: 'tiêu đề',
      cell: 'ô bảng',
      row: 'dòng',
      tab: 'tab',
      menuitem: 'mục menu',
      img: 'hình',
      dialog: 'hộp thoại',
      other: 'phần tử',
    },
    values: {
      visible: 'hiển thị',
      hidden: 'đang ẩn',
      notExist: 'không có trên trang',
      'not visible': 'không hiển thị',
    },
    codes: {
      UNKNOWN_ACTION: {
        message: 'Không nhận ra thao tác “{{action}}”.',
        hint: 'File test có thể được tạo bằng Kiemi mới hơn. Hãy cập nhật ứng dụng.',
      },
      INVALID_PARAMS: {
        message: 'Thông tin của bước bị thiếu hoặc chưa đúng.',
        hint: 'Mở bước này và điền đủ các ô được đánh dấu đỏ.',
      },
      STEP_TIMEOUT: {
        message: 'Bước chưa xong sau {{seconds}} giây.',
        hint: 'Trang có thể đang chậm. Tăng thời gian chờ của bước hoặc thêm bước “Chờ đến khi”.',
      },
      STEP_FAILED: {
        message: 'Bước gặp lỗi: {{reason}}',
        hint: 'Thử chạy lại. Nếu vẫn lỗi, xem ảnh chụp màn hình của bước này.',
      },
      RUN_CANCELLED: { message: 'Lần chạy đã bị dừng.', hint: 'Bấm Chạy để chạy lại.' },
      ELEMENT_NOT_FOUND: {
        message: 'Không tìm thấy {{element}} sau {{seconds}} giây.',
        hint: 'Kiểm tra trang đã mở đúng chưa, hoặc bấm “Chọn lại phần tử” để chỉ lại trên trang.',
      },
      ELEMENT_AMBIGUOUS: {
        message: 'Có {{count}} chỗ giống {{element}}, không biết chọn chỗ nào.',
        hint: 'Chọn “thứ mấy”, hoặc thêm ngữ cảnh như “trong dòng có…”, “cạnh nhãn…”.',
      },
      BROWSER_NOT_FOUND: {
        message: 'Không tìm thấy trình duyệt {{browser}} trên máy.',
        hint: 'Cài Edge hoặc Chrome, hoặc chọn “Tự động” để Kiemi tự tải trình duyệt.',
      },
      BROWSER_DOWNLOAD_FAILED: {
        message: 'Không tải được trình duyệt.',
        hint: 'Kiểm tra kết nối mạng rồi thử lại.',
      },
      BROWSER_LAUNCH_FAILED: {
        message: 'Không mở được trình duyệt {{browser}}.',
        hint: 'Đóng bớt cửa sổ trình duyệt hoặc khởi động lại máy rồi thử lại.',
      },
      UNKNOWN_DEVICE: {
        message: 'Không có thiết bị “{{device}}” để giả lập.',
        hint: 'Chọn một thiết bị trong danh sách.',
      },
      NO_BROWSER: {
        message: 'Lần chạy này chưa mở trình duyệt.',
        hint: 'Thử chạy lại. Nếu vẫn lỗi, gửi báo cáo lỗi cho chúng tôi.',
      },
      PROXY_SECRET_MISSING: {
        message: 'Chưa có mật khẩu proxy (bí mật “{{secret}}”).',
        hint: 'Vào Môi trường → Bí mật để nhập mật khẩu.',
      },
      UNKNOWN_VARIABLE: {
        message: 'Chưa có biến “{{name}}”.',
        hint: 'Kiểm tra tên biến, hoặc thêm bước “Lưu giá trị vào biến” trước bước này.',
      },
      INVALID_EXPRESSION: {
        message: 'Công thức chưa đúng: {{expression}}',
        hint: 'Xem lại dấu ngoặc, dấu nháy và phép tính.',
      },
      CONSOLE_ERROR: {
        message: 'Trang web báo lỗi: {{message}}',
        hint: 'Lỗi nằm ở trang web, không phải ở bài test. Báo cho đội phát triển, hoặc tắt “Dừng khi trang báo lỗi”.',
      },
      HTTP_ERROR: {
        message: 'Trang gọi máy chủ bị lỗi {{status}}.',
        hint: 'Máy chủ có thể đang lỗi. Báo cho đội phát triển, hoặc tắt “Dừng khi máy chủ báo lỗi”.',
      },
      ASSERTION_FAILED: {
        message: 'Kiểm tra không đạt: mong đợi “{{expected}}” nhưng thấy “{{actual}}”.',
        hint: 'Nếu kết quả mới là đúng, hãy sửa giá trị mong đợi của bước.',
      },
      CONDITION_TIMEOUT: {
        message: 'Sau {{seconds}} giây điều kiện vẫn chưa đúng.',
        hint: 'Tăng thời gian chờ, hoặc kiểm tra lại điều kiện.',
      },
      API_ERROR: {
        message: 'Không gọi được {{url}}.',
        hint: 'Kiểm tra địa chỉ, kết nối mạng/VPN và proxy của môi trường.',
      },
      FILE_NOT_FOUND: {
        message: 'Không tìm thấy file {{file}}.',
        hint: 'Kiểm tra file còn ở đó và đường dẫn đúng.',
      },
      TAB_NOT_FOUND: {
        message: 'Không tìm thấy tab “{{value}}”.',
        hint: 'Có thể tab chưa kịp mở. Thêm bước chờ trước bước này.',
      },
      UNKNOWN_SHARED_STEP: {
        message: 'Không tìm thấy bước dùng chung “{{shared}}”.',
        hint: 'Bước dùng chung có thể đã bị xóa hoặc đổi tên.',
      },
      ACTION_FAILED: {
        message: 'Không làm được thao tác: {{reason}}',
        hint: 'Xem ảnh chụp màn hình của bước để biết trang đang ở trạng thái nào.',
      },
      ENGINE_ERROR: {
        message: 'Kiemi gặp lỗi ngoài dự kiến.',
        hint: 'Thử chạy lại. Nếu vẫn lỗi, gửi báo cáo lỗi cho chúng tôi.',
      },
      ENGINE_CRASHED: {
        message: 'Bộ chạy test bị dừng đột ngột.',
        hint: 'Ứng dụng vẫn hoạt động bình thường. Bấm Chạy để chạy lại.',
      },
      SSH_FAILED: {
        message: 'Không kết nối được máy chủ SSH của môi trường.',
        hint: 'Vào Môi trường → SSH, bấm “Kiểm tra kết nối” để xem chi tiết.',
      },
    },
  },
  settings: {
    language: 'Ngôn ngữ',
    languages: {
      vi: 'Tiếng Việt',
      en: 'English',
    },
  },
} as const;
