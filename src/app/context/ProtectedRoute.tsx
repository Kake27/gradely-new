"use client"

import { useContext, useEffect } from "react";
import { UserContext } from "./ContextProvider";
import { useRouter } from "next/navigation";

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode; roles: string[] }) => {
  const { user, loading } = useContext(UserContext);
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user || !roles.includes(user.role)) {
        router.replace("/unauthorized");
      }
    }
  }, [user, loading, router, roles]);

  if (loading) return <div>Loading...</div>;

  if (!user || !roles.includes(user.role)) {
    return null; 
  }

  return <>{children}</>;
};

export default ProtectedRoute;