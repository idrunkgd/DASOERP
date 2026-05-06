// Wrapper minimal autour de <select> natif — RHF-compatible.
import { forwardRef, SelectHTMLAttributes } from "react";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
}

export const NativeSelect = forwardRef<HTMLSelectElement, Props>(({ options, className, ...rest }, ref) => (
  <select ref={ref} className={className ?? "input"} {...rest}>
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
));
NativeSelect.displayName = "NativeSelect";
