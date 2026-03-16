import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", this.props.fallbackTitle || "Component error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-6 border-destructive/30 bg-destructive/5">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="p-3 rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {this.props.fallbackTitle || "Erro ao renderizar componente"}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Ocorreu um erro inesperado. Tente novamente ou recarregue a página.
            </p>
            <Button variant="outline" size="sm" onClick={this.handleRetry}>
              <RefreshCw className="h-4 w-4 mr-1" /> Tentar novamente
            </Button>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
