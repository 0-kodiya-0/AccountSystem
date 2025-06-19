import { Shield, CheckCircle, AlertTriangle, Key, Info } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '../ui';

// Security Overview Component
interface SecurityOverviewProps {
  account: any;
}

export default function SecurityOverview({ account }: SecurityOverviewProps) {
  const securityScore = () => {
    let score = 0;
    if (account.security?.twoFactorEnabled) score += 40;
    if (account.accountType === 'oauth') score += 30;
    if (account.status === 'active') score += 20;
    if (account.userDetails.emailVerified) score += 10;
    return score;
  };

  const score = securityScore();
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Shield className="w-5 h-5" />
          <span>Security Overview</span>
        </CardTitle>
        <CardDescription>Your account security status and recommendations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Security Score */}
        <div className="text-center space-y-2">
          <div className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}%</div>
          <p className="text-sm text-muted-foreground">Security Score - {getScoreLabel(score)}</p>
        </div>

        {/* Security Features */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="w-4 h-4" />
              <span className="text-sm">Two-Factor Authentication</span>
            </div>
            {account.security?.twoFactorEnabled ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Key className="w-4 h-4" />
              <span className="text-sm">Account Type</span>
            </div>
            <Badge variant={account.accountType === 'oauth' ? 'default' : 'secondary'}>
              {account.accountType === 'oauth' ? account.provider : 'Local'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Email Verified</span>
            </div>
            {account.userDetails.emailVerified ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Info className="w-4 h-4" />
              <span className="text-sm">Account Status</span>
            </div>
            <Badge variant={account.status === 'active' ? 'default' : 'destructive'}>{account.status}</Badge>
          </div>
        </div>

        {/* Recommendations */}
        {score < 100 && (
          <div className="space-y-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <h4 className="font-medium text-sm">Security Recommendations</h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {!account.security?.twoFactorEnabled && <li>• Enable two-factor authentication for better security</li>}
              {account.accountType === 'local' && <li>• Consider using OAuth for additional security layers</li>}
              {!account.userDetails.emailVerified && <li>• Verify your email address</li>}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
