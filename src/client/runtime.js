/** React 注入层：factory 里 setReact 之后，所有模块通过 live binding 使用 React/h。 */
export let React = null;

export function setReact(react) {
  React = react;
}

export const h = (...args) => React.createElement(...args);
