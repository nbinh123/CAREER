import React, { createContext, useContext, useState } from 'react';
import './modalAnimations.css'; // Vẫn giữ nguyên file CSS ở phần trước nhé

const ModalContext = createContext();

export const useModal = () => useContext(ModalContext);

// Cấu hình Icon và Màu sắc theo từng trạng thái
const STATUS_CONFIG = {
  success: {
    icon: (
      <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    iconBg: 'bg-green-100',
    titleColor: 'text-green-700',
    btnColor: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
  },
  error: {
    icon: (
      <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    iconBg: 'bg-red-100',
    titleColor: 'text-red-700',
    btnColor: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
  },
  warning: {
    icon: (
      <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    iconBg: 'bg-orange-100',
    titleColor: 'text-orange-700',
    btnColor: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500',
  },
  info: {
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    iconBg: 'bg-blue-100',
    titleColor: 'text-blue-700',
    btnColor: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
  }
};

export const ModalProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [modalData, setModalData] = useState({
    animation: 'scale',
    status: 'info', // Thêm trạng thái mặc định
    title: '',
    content: null,
    onConfirm: null,
    onCancel: null,
  });

  // Cập nhật hàm gọi: Thêm tham số status
  const showModal = (animation = 'scale', status = 'info', title, content, onConfirm, onCancel) => {
    setModalData({ animation, status, title, content, onConfirm, onCancel });
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    if(modalData.onCancel) modalData.onCancel();
  };

  const handleConfirm = () => {
    if (modalData.onConfirm) modalData.onConfirm();
    closeModal();
  };

  const getAnimationClass = (animation) => {
    switch (animation) {
      case 'dropdown': return 'modal-dropdown';
      case 'slide': return 'modal-slide';
      case 'flip': return 'modal-flip';
      default: return 'modal-scale';
    }
  };

  // Lấy cấu hình dựa trên status hiện tại (nếu truyền sai thì mặc định là info)
  const currentStatus = STATUS_CONFIG[modalData.status] || STATUS_CONFIG['info'];

  return (
    <ModalContext.Provider value={{ showModal }}>
      {children}
      
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop p-4">
          <div className={`bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative ${getAnimationClass(modalData.animation)}`}>
            
            {/* Phần Header chứa Icon và Tiêu đề */}
            <div className="flex items-start gap-4 mb-4">
              <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${currentStatus.iconBg}`}>
                {currentStatus.icon}
              </div>
              <div className="pt-1 w-full">
                <h3 className={`text-lg font-bold ${currentStatus.titleColor}`}>
                  {modalData.title}
                </h3>
                {/* Nội dung */}
                <div className="text-gray-600 mt-2 text-sm leading-relaxed">
                  {modalData.content}
                </div>
              </div>
            </div>

            {/* Cụm nút bấm */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Đóng
              </button>
              
              {modalData.onConfirm && (
                <button
                  onClick={handleConfirm}
                  className={`px-4 py-2 text-white text-sm font-medium rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${currentStatus.btnColor}`}
                >
                  Đồng ý
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};