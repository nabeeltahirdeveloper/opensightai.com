import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: String(error?.message || error) };
  }

  componentDidCatch(error, info) {
    try {
      console.error("App error:", error, info);
    } catch (_e) {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: "Inter, ui-sans-serif, system-ui" }}>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Something went wrong</h2>
          <pre style={{ whiteSpace: "pre-wrap", background: "#fff7ed", border: "1px solid #fed7aa", padding: 12, borderRadius: 8 }}>
            {this.state.message}
          </pre>
          <p style={{ marginTop: 12, color: "#475569" }}>Check the browser console for details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}




