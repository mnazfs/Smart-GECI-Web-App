import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

const UHIModulePage = () => {
  const role = useAuthStore((s) => s.role);
  const navigate = useNavigate();

  useEffect(() => {
    if (role === "guest") {
      navigate("/login", { replace: true });
    } else if (role !== "authorized" && role !== "admin") {
      navigate("/", { replace: true });
    }
  }, [role, navigate]);

  if (role !== "authorized" && role !== "admin") {
    return null;
  }

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <iframe
        src="http://localhost:5174"
        title="UHI Dashboard"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
        }}
      />
    </div>
  );
};

export default UHIModulePage;
