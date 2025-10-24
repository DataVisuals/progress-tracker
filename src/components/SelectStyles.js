// Shared react-select styles for consistent appearance across the app
export const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '38px',
    fontSize: '14px',
    borderColor: state.isFocused ? '#00aeef' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(0, 174, 239, 0.1)' : 'none',
    '&:hover': {
      borderColor: '#00aeef'
    }
  }),
  menu: (base) => ({
    ...base,
    fontSize: '14px',
    zIndex: 1000
  }),
  option: (base, state) => ({
    ...base,
    padding: '8px 12px',
    backgroundColor: state.isSelected
      ? '#00aeef'
      : state.isFocused
      ? '#f3f4f6'
      : 'white',
    color: state.isSelected ? 'white' : '#374151',
    '&:active': {
      backgroundColor: '#003c71'
    }
  }),
  placeholder: (base) => ({
    ...base,
    color: '#9ca3af'
  }),
  singleValue: (base) => ({
    ...base,
    color: '#374151'
  })
};

// Compact version for audit log and dense UIs
export const compactSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '32px',
    fontSize: '13px',
    minWidth: '150px',
    borderColor: state.isFocused ? '#00aeef' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(0, 174, 239, 0.1)' : 'none',
    '&:hover': {
      borderColor: '#00aeef'
    }
  }),
  menu: (base) => ({
    ...base,
    fontSize: '13px',
    zIndex: 1000
  }),
  option: (base, state) => ({
    ...base,
    padding: '6px 12px',
    backgroundColor: state.isSelected
      ? '#00aeef'
      : state.isFocused
      ? '#f3f4f6'
      : 'white',
    color: state.isSelected ? 'white' : '#374151'
  }),
  placeholder: (base) => ({
    ...base,
    color: '#9ca3af',
    fontSize: '13px'
  }),
  singleValue: (base) => ({
    ...base,
    color: '#374151',
    fontSize: '13px'
  })
};
