"use client";

import { forwardRef, type ComponentType } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import { SquarePen } from "./animate-ui/icons/square-pen";
import { Delete } from "./animate-ui/icons/delete";
import { Plus } from "./animate-ui/icons/plus";
import { CircleCheckBig } from "./animate-ui/icons/circle-check-big";
import { Eye } from "./animate-ui/icons/eye";
import { EyeOff } from "./animate-ui/icons/eye-off";
import { Search } from "./animate-ui/icons/search";
import { Copy } from "./animate-ui/icons/copy";
import { X } from "./animate-ui/icons/x";

// Keep the SVG API and Lucide classes used by existing sizing and dismiss rules.
function actionIcon(Source: ComponentType, name: string): LucideIcon {
  const Icon = forwardRef<SVGSVGElement, LucideProps>(({ size = 24, className, absoluteStrokeWidth, strokeWidth = 2, ...props }, ref) => {
    const Component = Source as ComponentType<LucideProps>;
    return <Component ref={ref} size={size} strokeWidth={absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth} aria-hidden="true" className={`lucide lucide-${name}${className ? ` ${className}` : ""}`} {...props} />;
  });
  Icon.displayName = `${name}ActionIcon`;
  return Icon;
}

export const EditIcon = actionIcon(SquarePen, "square-pen");
export const DeleteIcon = actionIcon(Delete, "trash-2");
export const AddIcon = actionIcon(Plus, "plus");
export const SaveIcon = actionIcon(CircleCheckBig, "circle-check-big");
export const ViewIcon = actionIcon(Eye, "eye");
export const HideIcon = actionIcon(EyeOff, "eye-off");
export const SearchIcon = actionIcon(Search, "search");
export const CopyIcon = actionIcon(Copy, "copy");
export const CloseIcon = actionIcon(X, "x");
