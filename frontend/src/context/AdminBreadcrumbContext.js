import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';

/**
 * แทนที่ข้อความ breadcrumb ตามระยะจากขั้นสุดท้าย:
 * fromEnd = 1 → ขั้นสุดท้าย, 2 → ขั้นก่อนหน้า, …
 */
const RegisterSegmentContext = createContext(null);
const OverridesValueContext = createContext(null);

/** อยู่ภายใน Router — wrap AppContent */
export function AdminBreadcrumbProvider({ children }) {
  const { pathname } = useLocation();
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    setOverrides({});
  }, [pathname]);

  const registerSegment = useCallback((fromEnd, label) => {
    const key = String(fromEnd);
    setOverrides((prev) => {
      const next = { ...prev };
      if (label == null || label === '') {
        delete next[key];
      } else {
        next[key] = String(label);
      }
      return next;
    });
    return () => {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };
  }, []);

  return (
    <RegisterSegmentContext.Provider value={registerSegment}>
      <OverridesValueContext.Provider value={overrides}>
        {children}
      </OverridesValueContext.Provider>
    </RegisterSegmentContext.Provider>
  );
}

/** @param {number} fromEnd 1 = ขั้นสุดท้าย */
export function useAdminBreadcrumbSegment(fromEnd, label) {
  const registerSegment = useContext(RegisterSegmentContext);

  useEffect(() => {
    if (!registerSegment) return undefined;
    return registerSegment(fromEnd, label);
  }, [fromEnd, label, registerSegment]);
}

/** เทียบเท่า useAdminBreadcrumbSegment(1, label) */
export function useAdminBreadcrumbTail(label) {
  useAdminBreadcrumbSegment(1, label);
}

export function useAdminBreadcrumbOverrides() {
  return useContext(OverridesValueContext) || {};
}
