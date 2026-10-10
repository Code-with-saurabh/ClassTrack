import toast from 'react-hot-toast';

export const getApiErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error) return fallback;
  return (
    error.response?.data?.message ||
    error.message ||
    fallback
  );
};

// Same message ek saath stack nahi hoga — purana toast replace ho jayega
export const toastError = (error, fallback) => {
  const message = getApiErrorMessage(error, fallback);
  toast.error(message, { id: `err:${message}` });
};

export const toastSuccess = (message) => {
  toast.success(message, { id: `ok:${message}` });
};

export const toastInfo = (message) => {
  toast(message, { icon: 'ℹ️', id: `info:${message}` });
};

export const toastWarning = (message) => {
  toast(message, { icon: '⚠️', id: `warn:${message}` });
};

export const toastValidation = (message) => {
  toast.error(message, { icon: '⚠️', id: `val:${message}` });
};
