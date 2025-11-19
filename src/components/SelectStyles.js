// Helper to check if dark mode is active
const isDarkMode = () => document.documentElement.classList.contains('dark-mode');

// Shared react-select styles for consistent appearance across the app
export const selectStyles = {
  control: (base, state) => {
    const dark = isDarkMode();
    return {
      ...base,
      minHeight: '32px',
      height: '32px',
      fontSize: '0.6875rem',
      backgroundColor: dark ? '#1f2937' : 'white',
      borderColor: state.isFocused ? '#00aeef' : dark ? '#4b5563' : '#d1d5db',
      boxShadow: state.isFocused ? '0 0 0 3px rgba(0, 174, 239, 0.1)' : 'none',
      '&:hover': {
        borderColor: '#00aeef'
      }
    };
  },
  valueContainer: (base) => ({
    ...base,
    padding: '0 7px',
    height: '30px'
  }),
  input: (base) => {
    const dark = isDarkMode();
    return {
      ...base,
      margin: '0',
      padding: '0',
      height: '30px',
      color: dark ? '#f9fafb' : '#374151'
    };
  },
  indicatorSeparator: () => ({
    display: 'none'
  }),
  dropdownIndicator: (base) => {
    const dark = isDarkMode();
    return {
      ...base,
      padding: '4px',
      color: dark ? '#9ca3af' : '#6b7280'
    };
  },
  clearIndicator: (base) => {
    const dark = isDarkMode();
    return {
      ...base,
      padding: '4px',
      color: dark ? '#9ca3af' : '#6b7280'
    };
  },
  menu: (base) => {
    const dark = isDarkMode();
    return {
      ...base,
      fontSize: '0.6875rem',
      zIndex: 9999,
      backgroundColor: dark ? '#1f2937' : 'white',
      borderColor: dark ? '#374151' : '#d1d5db'
    };
  },
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999
  }),
  option: (base, state) => {
    const dark = isDarkMode();
    return {
      ...base,
      padding: '4px 7px',
      backgroundColor: state.isSelected
        ? '#00aeef'
        : state.isFocused
        ? dark ? '#374151' : '#f3f4f6'
        : dark ? '#1f2937' : 'white',
      color: state.isSelected ? 'white' : dark ? '#f9fafb' : '#374151',
      '&:active': {
        backgroundColor: '#003c71'
      }
    };
  },
  placeholder: (base) => ({
    ...base,
    color: '#9ca3af',
    fontSize: '0.6875rem'
  }),
  singleValue: (base) => {
    const dark = isDarkMode();
    return {
      ...base,
      color: dark ? '#f9fafb' : '#374151',
      fontSize: '0.6875rem'
    };
  }
};

// Compact version for audit log and dense UIs
export const compactSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '32px',
    fontSize: '13px',
    minWidth: '150px',
    backgroundColor: isDarkMode() ? '#1f2937' : 'white',
    borderColor: state.isFocused ? '#00aeef' : isDarkMode() ? '#4b5563' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(0, 174, 239, 0.1)' : 'none',
    '&:hover': {
      borderColor: '#00aeef'
    }
  }),
  menu: (base) => ({
    ...base,
    fontSize: '13px',
    zIndex: 9999,
    backgroundColor: isDarkMode() ? '#1f2937' : 'white'
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999
  }),
  option: (base, state) => ({
    ...base,
    padding: '6px 12px',
    backgroundColor: state.isSelected
      ? '#00aeef'
      : state.isFocused
      ? isDarkMode() ? '#374151' : '#f3f4f6'
      : isDarkMode() ? '#1f2937' : 'white',
    color: state.isSelected ? 'white' : isDarkMode() ? '#f9fafb' : '#374151'
  }),
  placeholder: (base) => ({
    ...base,
    color: '#9ca3af',
    fontSize: '13px'
  }),
  singleValue: (base) => ({
    ...base,
    color: isDarkMode() ? '#f9fafb' : '#374151',
    fontSize: '13px'
  })
};
