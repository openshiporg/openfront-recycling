/* Line icons drawn for the storefront (stroke = currentColor), in the weight of the Capella design. */
type P = { size?: number; className?: string; title?: string };
const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });
const aria = (title?: string) => (title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true });

export const IconLaptopCheck = ({ size = 56, className, title }: P) => (
  <svg {...base(size)} className={className} {...aria(title)}><rect x="9" y="9" width="30" height="21" rx="2.5" /><path d="M4 36h40l-3 4H7z" /><path d="m18 19 4.5 4.5L31 15" /></svg>
);
export const IconQr = ({ size = 56, className, title }: P) => (
  <svg {...base(size)} className={className} {...aria(title)}><rect x="7" y="5" width="34" height="38" rx="5" /><rect x="13" y="11" width="8" height="8" /><rect x="27" y="11" width="8" height="8" /><rect x="13" y="25" width="8" height="8" /><path d="M27 25h3v3h-3zM33 29h2v6h-6v-3" /></svg>
);
export const IconTruckScale = ({ size = 56, className, title }: P) => (
  <svg {...base(size)} className={className} {...aria(title)}><path d="M5 30V17h22v13M27 21h8l5 5v4H27" /><circle cx="13" cy="32" r="3" /><circle cx="34" cy="32" r="3" /><path d="M3 38h42l-3 4H6z" /></svg>
);
export const IconCash = ({ size = 56, className, title }: P) => (
  <svg {...base(size)} className={className} {...aria(title)}><path d="m6 18 30-8 3 10M10 22l30-8 3 10" /><rect x="5" y="22" width="34" height="18" rx="2" transform="rotate(-6 22 31)" /><path d="M22 26v10M25 28h-4.5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4H19" /></svg>
);
export const IconBolt = ({ size = 40, className, title }: P) => (
  <svg {...base(size)} className={className} {...aria(title)}><path d="M27 4 10 27h12l-4 17 19-25H25z" fill="currentColor" stroke="none" /></svg>
);
export const IconScale = ({ size = 40, className, title }: P) => (
  <svg {...base(size)} className={className} {...aria(title)}><path d="M24 6v34M10 42h28M8 14h32M14 14 7 28a7 7 0 0 0 14 0zM34 14l-7 14a7 7 0 0 0 14 0z" /></svg>
);
export const IconTag = ({ size = 40, className, title }: P) => (
  <svg {...base(size)} className={className} {...aria(title)}><path d="M6 24V8a2 2 0 0 1 2-2h16l18 18-18 18z" /><circle cx="15" cy="15" r="3" /></svg>
);
export const IconClock = ({ size = 40, className, title }: P) => (
  <svg {...base(size)} className={className} {...aria(title)}><circle cx="24" cy="24" r="18" /><path d="M24 13v12l8 5" /></svg>
);
export const IconPin = ({ size = 22, className, title }: P) => (
  <svg {...base(size)} className={className} {...aria(title)}><path d="M24 44s14-13 14-24a14 14 0 0 0-28 0c0 11 14 24 14 24z" /><circle cx="24" cy="20" r="5" /></svg>
);
export const IconPhone = ({ size = 22, className, title }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...aria(title)}><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" /></svg>
);
export const IconMail = ({ size = 22, className, title }: P) => (
  <svg {...base(size)} className={className} {...aria(title)}><rect x="5" y="11" width="38" height="26" rx="2" /><path d="m5 13 19 14 19-14" /></svg>
);
export const IconContainer = ({ size = 40, className, title }: P) => (
  <svg {...base(size)} className={className} {...aria(title)}><path d="M4 16h40l-5 22H9z" /><path d="M14 16v22M24 16v22M34 16v22" /></svg>
);
export const IconBuilding = ({ size = 40, className, title }: P) => (
  <svg {...base(size)} className={className} {...aria(title)}><path d="M6 42V18l12-8v32M18 42V6h24v36M4 42h40M24 14h4M32 14h4M24 22h4M32 22h4M24 30h4M32 30h4" /></svg>
);
export const IconMenu = ({ size = 22, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden><path d="M8 14h32M8 24h32M8 34h32" /></svg>
);
export const IconArrow = ({ size = 22, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden><path d="M8 24h30M28 13l11 11-11 11" /></svg>
);
export const IconId = ({ size = 40, className, title }: P) => (
  <svg {...base(size)} className={className} {...aria(title)}><rect x="4" y="10" width="40" height="28" rx="3" /><circle cx="16" cy="22" r="4" /><path d="M9 32a7 7 0 0 1 14 0M28 19h10M28 25h10M28 31h6" /></svg>
);
