import type { StaffFormState, StaffUser } from "@/features/staff/types";

export function createEmptyStaffForm(): StaffFormState {
  return {
    name: "",
    email: "",
    password: "",
    isActive: true,
    permissionKeys: []
  };
}

export function toFormState(staffUser: StaffUser): StaffFormState {
  return {
    name: staffUser.name,
    email: staffUser.email,
    password: "",
    isActive: staffUser.isActive,
    permissionKeys: staffUser.permissionKeys
  };
}
