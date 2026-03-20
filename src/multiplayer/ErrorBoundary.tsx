// @ts-nocheck
import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
          background:'#1a1e2e',color:'#e0e0f0',fontFamily:'monospace',padding:40,textAlign:'center'}}>
          <div style={{fontSize:24,marginBottom:16,color:'#ff4444'}}>Something went wrong</div>
          <div style={{fontSize:14,color:'#888',marginBottom:24}}>{String(this.state.error)}</div>
          <button onClick={() => window.location.reload()} style={{padding:'12px 24px',background:'#667eea',
            color:'white',border:'none',borderRadius:8,fontSize:16,cursor:'pointer'}}>Reload Game</button>
        </div>
      );
    }
    return this.props.children;
  }
}
