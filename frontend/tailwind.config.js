/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F6F7F5",
        surface: {
          DEFAULT: "#FFFFFF",
          secondary: "#F1F3F0",
          hover: "#F5F6F4",
        },
        primaryText: "#1F2933",
        secondaryText: "#5F6B66",
        mutedText: "#87918C",
        borderDefault: "#DCE1DD",
        borderStrong: "#C7CEC9",
        status: {
          normal: {
            DEFAULT: "#4F8A62",
            bg: "#FFFFFF",
            badgeBg: "#EBF5EE",
            badgeBorder: "#C2E2CC",
            text: "#265C39",
          },
          advisory: {
            DEFAULT: "#C89A18",
            bg: "#FFF9E8",
            border: "#F0D98A",
            text: "#7A5C05",
          },
          warning: {
            DEFAULT: "#C97819",
            bg: "#FFF3E6",
            border: "#E8B66A",
            text: "#874804",
          },
          critical: {
            DEFAULT: "#C94A4A",
            bg: "#FFF0F0",
            border: "#E7A2A2",
            text: "#912828",
          },
        },
      },
      borderRadius: {
        sm: "6px",
        card: "10px",
        lg: "12px",
        btn: "8px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0, 0, 0, 0.04)",
        toast: "0 4px 12px rgba(0, 0, 0, 0.08)",
      },
    },
  },
  plugins: [],
};
