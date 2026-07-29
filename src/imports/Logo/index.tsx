import { useId } from "react";
import svgPaths from "./svg-lwmsewirn2";

export default function Logo() {
  const uid = useId().replace(/:/g, "");
  const gradId = `union-grad-${uid}`;
  return (
    <div className="relative size-full" data-name="Logo">
      <svg className="absolute block inset-0 size-full" fill="none" height="299" preserveAspectRatio="none" viewBox="0 0 296 299" width="296">
        <path d={svgPaths.pd84b00} fill={`url(#${gradId})`} />
        <defs>
          <linearGradient gradientUnits="userSpaceOnUse" id={gradId} x1="148" x2="148" y1="0" y2="299">
            <stop stopColor="#0246F3" />
            <stop offset="1" stopColor="#4A7DF1" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
