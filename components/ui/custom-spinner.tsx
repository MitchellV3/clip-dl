import React from "react"

export const CustomSpinner = ({ size = "xl" }: { size?: string }) => {
    const sizeMap = {
        xs: "5px",
        sm: "10px",
        md: "15px",
        lg: "25px",
        xl: "35px",
    }

    const dimension = sizeMap[size as keyof typeof sizeMap] || sizeMap.xl

    return (
        <div
            style={{
                width: dimension,
                height: dimension,
                border: "4px solid rgba(255, 255, 255, 0.2)",
                borderTop: "4px solid white",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
            }}
        >
            <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    )
}
