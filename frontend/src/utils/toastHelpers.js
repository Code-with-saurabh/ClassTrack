import toast from 'react-hot-toast';

export const getApiErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error) return fallback;
  return (
    error.response?.data?.message ||
    error.message ||
    fallback
  );
};

export const toastError = (error, fallback) => {
  toast.error(getApiErrorMessage(error, fallback));
};

export const toastSuccess = (message) => {
  toast.success(message);
};

export const toastInfo = (message) => {
  toast(message, { icon: 'ℹ️' });
};

export const toastWarning = (message) => {
  toast(message, { icon: '⚠️' });
};

export const toastValidation = (message) => {
  toast.error(message, { icon: '⚠️' });
};
