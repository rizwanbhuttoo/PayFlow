import { useCallback, useMemo } from "react";
import { useHistory, useLocation } from "react-router-dom";

export const useNavigate = () => {
  const history = useHistory();
  return useCallback(
    (target, options = {}) => {
      if (typeof target === "number") {
        history.go(target);
        return;
      }
      const method = options.replace ? "replace" : "push";
      history[method](target, options.state);
    },
    [history]
  );
};

export const useSearchParams = () => {
  const location = useLocation();
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );
  return [searchParams];
};
