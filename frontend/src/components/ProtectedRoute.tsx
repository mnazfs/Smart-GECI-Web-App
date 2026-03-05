import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import type { UserRole } from "@/types/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole: UserRole;
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const role = useAuthStore((s) => s.role);

  if (requiredRole === "admin" && role !== "admin") {
    return <Navigate to="/" replace />;
  }

  if (
    requiredRole === "authorized" &&
    role !== "authorized" &&
    role !== "admin"
  ) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
