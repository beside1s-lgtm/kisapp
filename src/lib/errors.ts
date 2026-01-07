export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  public context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    const { path, operation, requestResourceData } = context;

    const requestDetails = {
      operation,
      path,
      ...(requestResourceData && { resource: requestResourceData }),
    };
    
    const message = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules: \n${JSON.stringify(requestDetails, null, 2)}`;
    super(message);

    this.name = 'FirestorePermissionError';
    this.context = context;

    // This is to make the error message visible in the Next.js overlay
    this.stack = '';
  }
}
