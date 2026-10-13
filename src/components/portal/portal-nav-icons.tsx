"use client";

import { useMemo, useRef, type ComponentType, type HTMLAttributes, type RefAttributes } from "react";
import { useIconCycle } from "@/components/use-icon-cycle";
import { BookTextIcon } from "@/components/lucide-animated/book-text";
import { BriefcaseBusinessIcon } from "@/components/lucide-animated/briefcase-business";
import { CalendarDaysIcon } from "@/components/lucide-animated/calendar-days";
import { CalendarCheckIcon } from "@/components/lucide-animated/calendar-check";
import { FileTextIcon } from "@/components/lucide-animated/file-text";
import { FolderPlusIcon } from "@/components/lucide-animated/folder-plus";
import { MailCheckIcon } from "@/components/lucide-animated/mail-check";
import { ShieldCheckIcon } from "@/components/lucide-animated/shield-check";
import { StampIcon } from "@/components/lucide-animated/stamp";
import { TicketIcon } from "@/components/lucide-animated/ticket";
import { UserRoundCogIcon } from "@/components/lucide-animated/user-round-cog";
import { WrenchIcon } from "@/components/lucide-animated/wrench";
import { GripIcon } from "@/components/lucide-animated/grip";
import { ScanTextIcon } from "@/components/lucide-animated/scan-text";
import { UserRoundPlusIcon } from "@/components/lucide-animated/user-round-plus";

export { ChartColumn } from "@/components/animate-ui/icons/chart-column";
export { CirclePlus } from "@/components/animate-ui/icons/circle-plus";
export { ChevronDown } from "@/components/animate-ui/icons/chevron-down";
export { Radio } from "@/components/animate-ui/icons/radio";
export { Clipboard as Inbox } from "@/components/animate-ui/icons/clipboard";
export { ClipboardCheck as ListChecks } from "@/components/animate-ui/icons/clipboard-check";
export { Fingerprint as Vote } from "@/components/animate-ui/icons/fingerprint";
export { Gavel } from "@/components/animate-ui/icons/gavel";
export { LayoutDashboard } from "@/components/animate-ui/icons/layout-dashboard";
export { PanelLeft } from "@/components/animate-ui/icons/panel-left";
export { List as Hash } from "@/components/animate-ui/icons/list";
export { List } from "@/components/animate-ui/icons/list";
export { GalleryHorizontalEnd } from "@/components/animate-ui/icons/gallery-horizontal-end";
export { Send } from "@/components/animate-ui/icons/send";
export { SlidersHorizontal as Settings2 } from "@/components/animate-ui/icons/sliders-horizontal";
export { Users } from "@/components/animate-ui/icons/users";
export { UsersRound as Flag } from "@/components/animate-ui/icons/users-round";

export type PortalIconProps = { size?: number; strokeWidth?: number; animate?: boolean; "aria-hidden"?: boolean | "true" };
export type PortalIcon = ComponentType<PortalIconProps>;
type AnimationHandle = { startAnimation: () => void; stopAnimation: () => void };
type ControlledIcon = ComponentType<HTMLAttributes<HTMLDivElement> & { size?: number } & RefAttributes<AnimationHandle>>;

/** Bridge Lucide Animated's imperative API to Animate UI's boolean trigger. */
function controlledIcon(Source: ControlledIcon): PortalIcon {
  function Icon({ animate = false, size, "aria-hidden": ariaHidden }: PortalIconProps) {
    const ref = useRef<AnimationHandle>(null);
    const element = useRef<HTMLSpanElement>(null);
    const controls = useMemo(() => ({
      // The child Motion component cancels its animations on unmount.
      stop: () => {},
      set: () => ref.current?.stopAnimation(),
      start: (variant: string) => variant === "animate" ? ref.current?.startAnimation() : ref.current?.stopAnimation(),
    }), []);
    useIconCycle(element, controls, { active: animate, normal: "normal" });
    return <span ref={element} data-icon-motion="" style={{ display: "inline-flex", flexShrink: 0 }}><Source ref={ref} size={size} aria-hidden={ariaHidden} /></span>;
  }
  return Icon;
}

export const BookOpenText = controlledIcon(BookTextIcon);
export const Briefcase = controlledIcon(BriefcaseBusinessIcon);
export const Calendar = controlledIcon(CalendarDaysIcon);
export const CalendarDays = Calendar;
export const CalendarCheck = controlledIcon(CalendarCheckIcon);
export const FileText = controlledIcon(FileTextIcon);
export const FolderPlus = controlledIcon(FolderPlusIcon);
export const MailCheck = controlledIcon(MailCheckIcon);
export const ScrollText = FileText;
export const ShieldCheck = controlledIcon(ShieldCheckIcon);
export const Stamp = controlledIcon(StampIcon);
export const Ticket = controlledIcon(TicketIcon);
export const UserCog = controlledIcon(UserRoundCogIcon);
export const Wrench = controlledIcon(WrenchIcon);
export const Grip = controlledIcon(GripIcon);
export const ScanText = controlledIcon(ScanTextIcon);
export const UserRoundPlus = controlledIcon(UserRoundPlusIcon);

export function NavSymbol({ icon: Icon, active, engaged = false }: { icon: PortalIcon; active: boolean; engaged?: boolean }) {
  return <span className="portal-nav-symbol" data-icon-motion="" aria-hidden="true"><Icon size={17} strokeWidth={1.7} animate={active || engaged} /></span>;
}
