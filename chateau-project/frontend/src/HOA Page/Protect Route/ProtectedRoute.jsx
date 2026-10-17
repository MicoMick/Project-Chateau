import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ userRole, allowedRoles, exclusive, children }) => {
  if (!userRole) {
    // No role stored — not logged in or session cleared
    return <Navigate to="/admin" replace />;
  }

  // super_admin has God-mode access to everything
  if (userRole === 'super_admin') {
    return children;
  }

  // president has full access to all HOA pages — EXCEPT routes marked
  // `exclusive`, which opt out of this blanket bypass on purpose (e.g.
  // Elections is Elecom-only; President shouldn't be able to manage it just
  // by virtue of being President, even by typing the URL directly).
  if (userRole === 'president' && !exclusive) {
    return children;
  }

  // All other roles — must be explicitly listed in allowedRoles
  if (!allowedRoles || !allowedRoles.includes(userRole)) {
    console.warn(`[ProtectedRoute] Access denied for role: "${userRole}". Required: [${allowedRoles?.join(', ')}]`);

    // Treasurer and auditor get redirected to their home page, not dashboard
    if (userRole === 'treasurer') return <Navigate to="/hoa/payments" replace />;
    if (userRole === 'auditor')   return <Navigate to="/hoa/auditor-workspace" replace />;

    // Everyone else goes to dashboard
    return <Navigate to="/hoa/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
