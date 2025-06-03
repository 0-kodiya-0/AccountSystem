# OpenSSL Certificate Generation Guide

This guide explains how to generate RSA certificates for the AccountSystem internal HTTPS server using OpenSSL.

## Overview

The internal server requires:

1. **CA Certificate** - Certificate Authority to sign other certificates
2. **Server Certificate** - For the account server (signed by CA)
3. **Client Certificates** - For internal services (signed by same CA)

## Prerequisites

- OpenSSL installed on your system
- Basic understanding of PKI (Public Key Infrastructure)

## Step-by-Step Certificate Generation

### 1. Create Certificate Directory Structure

```bash
# Create directory for certificates
mkdir -p certs
cd certs

# Create subdirectories for organization
mkdir ca server clients
```

### 2. Generate Certificate Authority (CA)

#### 2.1 Create CA Private Key

```bash
# Generate 4096-bit RSA private key for CA
openssl genrsa -out ca/ca-private-key.pem 4096

# Set secure permissions
chmod 600 ca/ca-private-key.pem
```

#### 2.2 Create CA Certificate

```bash
# Generate CA certificate (valid for 10 years)
openssl req -new -x509 -days 3650 -key ca/ca-private-key.pem -out ca/ca-cert.pem \
    -subj "/C=US/ST=California/L=San Francisco/O=AccountSystem/OU=Internal CA/CN=AccountSystem Internal CA"

# Set readable permissions
chmod 644 ca/ca-cert.pem
```

### 3. Generate Server Certificate (Account Server)

#### 3.1 Create Server Private Key

```bash
# Generate server private key
openssl genrsa -out server/account-server-key.pem 4096

# Set secure permissions
chmod 600 server/account-server-key.pem
```

#### 3.2 Create Server Certificate Signing Request (CSR)

```bash
# Create CSR for server certificate
openssl req -new -key server/account-server-key.pem -out server/account-server.csr \
    -subj "/C=US/ST=California/L=San Francisco/O=AccountSystem/OU=Server/CN=account-server"
```

#### 3.3 Create Server Certificate Extensions

```bash
# Create extensions file for server certificate
cat > server/server-extensions.conf << EOF
basicConstraints = CA:FALSE
nsCertType = server
nsComment = "AccountSystem Server Certificate"
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer:always
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = account-server
DNS.2 = localhost
DNS.3 = *.internal.accountsystem.local
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
```

#### 3.4 Sign Server Certificate with CA

```bash
# Generate server certificate signed by CA (valid for 2 years)
openssl x509 -req -days 730 -in server/account-server.csr \
    -CA ca/ca-cert.pem -CAkey ca/ca-private-key.pem -CAcreateserial \
    -out server/account-server-cert.pem \
    -extensions v3_req -extfile server/server-extensions.conf

# Set readable permissions
chmod 644 server/account-server-cert.pem

# Clean up CSR
rm server/account-server.csr
```

### 4. Generate Client Certificate (Internal Service)

#### 4.1 Generate Analytics Service Certificate (Example)

```bash
# Create directory for analytics service
mkdir -p clients/analytics-service

# Generate client private key
openssl genrsa -out clients/analytics-service/analytics-service-key.pem 4096
chmod 600 clients/analytics-service/analytics-service-key.pem

# Create client CSR
openssl req -new -key clients/analytics-service/analytics-service-key.pem \
    -out clients/analytics-service/analytics-service.csr \
    -subj "/C=US/ST=California/L=San Francisco/O=AccountSystem/OU=Internal Service/CN=analytics-service"

# Create client extensions file
cat > clients/analytics-service/client-extensions.conf << EOF
basicConstraints = CA:FALSE
nsCertType = client, email
nsComment = "AccountSystem Internal Service Certificate"
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
keyUsage = critical, nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth, emailProtection
EOF

# Sign client certificate with CA (valid for 1 year)
openssl x509 -req -days 365 -in clients/analytics-service/analytics-service.csr \
    -CA ca/ca-cert.pem -CAkey ca/ca-private-key.pem -CAcreateserial \
    -out clients/analytics-service/analytics-service-cert.pem \
    -extensions v3_req -extfile clients/analytics-service/client-extensions.conf

chmod 644 clients/analytics-service/analytics-service-cert.pem

# Clean up temporary files
rm clients/analytics-service/analytics-service.csr
rm clients/analytics-service/client-extensions.conf
```

> **Note:** Repeat these commands with different service names to generate certificates for additional internal services.

### 5. Verify Certificate Chain

```bash
# Verify server certificate against CA
openssl verify -CAfile ca/ca-cert.pem server/account-server-cert.pem

# Verify client certificates against CA
openssl verify -CAfile ca/ca-cert.pem clients/analytics-service/analytics-service-cert.pem
openssl verify -CAfile ca/ca-cert.pem clients/monitoring-service/monitoring-service-cert.pem

# Check certificate details
openssl x509 -in server/account-server-cert.pem -text -noout
openssl x509 -in clients/analytics-service/analytics-service-cert.pem -text -noout
```

### 6. Get Certificate Fingerprints (Optional)

```bash
# Get SHA256 fingerprints for logging/debugging
echo "CA Certificate Fingerprint:"
openssl x509 -fingerprint -sha256 -noout -in ca/ca-cert.pem

echo "Server Certificate Fingerprint:"
openssl x509 -fingerprint -sha256 -noout -in server/account-server-cert.pem

echo "Client Certificate Fingerprints:"
for cert in clients/*/.*-cert.pem; do
    service=$(basename $(dirname $cert))
    echo "  ${service}:"
    openssl x509 -fingerprint -sha256 -noout -in "$cert"
done
```

## Environment Variables Setup

After generating certificates, update your `.env` file:

```bash
# Internal HTTPS Server Configuration
INTERNAL_PORT=4443
INTERNAL_SERVER_ENABLED=true

# Certificate paths (adjust paths as needed)
INTERNAL_SERVER_KEY_PATH=./certs/server/account-server-key.pem
INTERNAL_SERVER_CERT_PATH=./certs/server/account-server-cert.pem
INTERNAL_CA_CERT_PATH=./certs/ca/ca-cert.pem
```

## Certificate Directory Structure

After completion, your certificate directory should look like:

```
certs/
├── ca/
│   ├── ca-private-key.pem      # CA private key (keep secure!)
│   ├── ca-cert.pem             # CA certificate (public)
│   └── ca-cert.srl             # Serial number file
├── server/
│   ├── account-server-key.pem  # Server private key
│   └── account-server-cert.pem # Server certificate
└── clients/
    └── analytics-service/
        ├── analytics-service-key.pem
        └── analytics-service-cert.pem
```

## Security Best Practices

### 1. File Permissions

```bash
# Set proper permissions
chmod 600 certs/ca/ca-private-key.pem
chmod 600 certs/server/account-server-key.pem
chmod 600 certs/clients/analytics-service/analytics-service-key.pem
chmod 644 certs/ca/ca-cert.pem
chmod 644 certs/server/account-server-cert.pem
chmod 644 certs/clients/analytics-service/analytics-service-cert.pem
```

### 2. Backup Strategy

```bash
# Create secure backup of CA private key
cp certs/ca/ca-private-key.pem /secure/backup/location/
chmod 600 /secure/backup/location/ca-private-key.pem
```

### 3. Certificate Renewal

```bash
# Check certificate expiration
openssl x509 -enddate -noout -in server/account-server-cert.pem
openssl x509 -enddate -noout -in clients/analytics-service/analytics-service-cert.pem

# Set up monitoring for certificate expiration
# Certificates should be renewed before expiry
```

## Testing the Setup

### 1. Test Certificate Validation

```bash
# Test with curl (should fail without client cert)
curl -k https://localhost:4443/internal/health

# Test with client certificate (add appropriate service headers)
curl -k --cert clients/analytics-service/analytics-service-cert.pem \
        --key clients/analytics-service/analytics-service-key.pem \
        -H "X-Internal-Service-ID: ANALYTICS" \
        -H "X-Internal-Service-Secret: your-service-secret" \
        https://localhost:4443/internal/health
```

### 2. Verify Certificate Chain

```bash
# Check if client cert is signed by same CA as server
openssl verify -CAfile ca/ca-cert.pem server/account-server-cert.pem
openssl verify -CAfile ca/ca-cert.pem clients/analytics-service/analytics-service-cert.pem
```

This guide provides all the commands needed to generate and manage RSA certificates for your AccountSystem internal HTTPS server!
