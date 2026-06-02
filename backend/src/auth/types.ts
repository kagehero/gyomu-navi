import type { AppRole } from "../users/user.entity";

/**
 * Subject claims we carry inside the JWT *and* expose as the resolved
 * `request.user` value. Kept narrow on purpose — adding fields here
 * forces token re-issuance on every change.
 */
export type AuthedUser = {
  id: string;
  email: string;
  role: AppRole;
  staffId: string | null;
  departmentId: string | null;
};

export type JwtPayload = {
  sub: string;
  email: string;
  role: AppRole;
};
