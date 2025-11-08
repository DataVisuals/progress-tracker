// Shared react-select styles for consistent appearance across the app
export const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '32px',
    height: '32px',
    fontSize: '0.6875rem',
    borderColor: state.isFocused ? '#00aeef' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(0, 174, 239, 0.1)' : 'none',
    '&:hover': {
      borderColor: '#00aeef'
    }
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '0 7px',
    height: '30px'
  }),
  input: (base) => ({
    ...base,
    margin: '0',
    padding: '0',
    height: '30px'
  }),
  indicatorSeparator: () => ({
    display: 'none'
  }),
  dropdownIndicator: (base) => ({
    ...base,
    padding: '4px'
  }),
  clearIndicator: (base) => ({
    ...base,
    padding: '4px'
  }),
  menu: (base) => ({
    ...base,
    fontSize: '0.6875rem',
    zIndex: 9999
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999
  }),
  option: (base, state) => ({
    ...base,
    padding: '4px 7px',
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
    color: '#9ca3af',
    fontSize: '0.6875rem'
  }),
  singleValue: (base) => ({
    ...base,
    color: '#374151',
    fontSize: '0.6875rem'
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
    zIndex: 9999
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
