import { useEffect, useRef, useState } from "react";

type UseWorkbenchFormatMenuOptions = {
    createSketchWithFormat: (width: number, height: number) => void;
};

export const sketchFormats = [
    { label: "1:1 Square", width: 1024, height: 1024 },
    { label: "2:3 Portrait", width: 682, height: 1024 },
    { label: "3:2 Landscape", width: 1024, height: 682 },
    { label: "16:9 Wide", width: 1024, height: 576 },
    { label: "9:16 Tall", width: 576, height: 1024 },
];

export function useWorkbenchFormatMenu({ createSketchWithFormat }: UseWorkbenchFormatMenuOptions) {
    const [showFormatDropdown, setShowFormatDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Element)) {
                setShowFormatDropdown(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleFormatSelect = (width: number, height: number) => {
        createSketchWithFormat(width, height);
        setShowFormatDropdown(false);
    };

    return {
        showFormatDropdown,
        setShowFormatDropdown,
        dropdownRef,
        handleFormatSelect,
    };
}
