// ErrorBoundary.js — Dark Obsidian React Error Boundary for TubeApp [BUG-020]
import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled render error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    if (typeof window !== 'undefined' && window.location?.reload) {
      window.location.reload();
    } else {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  render() {
    if (this.state.hasError) {
      const errorMessage =
        this.state.error?.message || String(this.state.error) || 'An unexpected render error occurred.';
      return (
        <View style={errorBoundaryStyles.container}>
          <View style={errorBoundaryStyles.card}>
            <Text style={errorBoundaryStyles.title}>Something went wrong</Text>
            <Text style={errorBoundaryStyles.subtitle}>
              Orphee encountered a render issue. You can reload the app to recover.
            </Text>
            <View style={errorBoundaryStyles.errorBox}>
              <Text style={errorBoundaryStyles.errorText} numberOfLines={6}>
                {errorMessage}
              </Text>
            </View>
            <TouchableOpacity
              style={errorBoundaryStyles.reloadButton}
              onPress={this.handleReload}
              activeOpacity={0.85}
              accessibilityLabel="Reload application"
            >
              <Text style={errorBoundaryStyles.reloadButtonText}>Reload App</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const errorBoundaryStyles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: Platform.OS === 'web' ? '100vh' : '100%',
    backgroundColor: '#0A0C10',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#151821',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#242936',
    padding: 24,
    alignItems: 'center',
  },
  title: {
    color: '#FF8C00',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  errorBox: {
    width: '100%',
    backgroundColor: '#0E1118',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2433',
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  reloadButton: {
    backgroundColor: '#FF8C00',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  reloadButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default ErrorBoundary;
