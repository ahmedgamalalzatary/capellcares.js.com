export type StaffUser = {
  id: number;
  name: string;
  email: string;
  role: "staff";
  isActive: boolean;
  permissionKeys: string[];
};

export type StaffFormState = {
  name: string;
  email: string;
  password: string;
  isActive: boolean;
  permissionKeys: string[];
};
