import { useState, useEffect, useCallback } from "react";

/**
 * Debounced search hook for optimized text filtering.
 * Returns both the raw input value and a debounced value for filtering.
 */
export function useDebouncedSearch(delay = 300) {
  const [inputValue, setInputValue] = useState("");
  const [debouncedValue, setDebouncedValue] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, delay);

    return () => clearTimeout(timer);
  }, [inputValue, delay]);

  const clear = useCallback(() => {
    setInputValue("");
    setDebouncedValue("");
  }, []);

  return {
    value: inputValue,
    debouncedValue,
    onChange: setInputValue,
    clear,
  };
}
