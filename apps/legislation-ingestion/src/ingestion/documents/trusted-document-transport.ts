import { request as httpsRequest, Agent as HttpsAgent } from "node:https"
import { Readable } from "node:stream"
import { rootCertificates } from "node:tls"

/**
 * These official publishers currently omit their issuing intermediate
 * certificate. Node intentionally does not retrieve intermediates from a
 * certificate's AIA URL, so an otherwise valid HTTPS request fails before an
 * HTTP response exists. Keep the supplements tightly bound to the affected
 * publisher hosts: hostname validation and all normal root validation remain
 * in force.
 *
 * Sources are the issuer URLs advertised by the live leaf certificates:
 * - http://certificates.godaddy.com/repository/gdig2.crt
 * - http://secure.globalsign.com/cacert/gsrsaovsslca2018.crt
 * - http://cacerts.digicert.com/DigiCertGlobalG2TLSRSASHA2562020CA1-1.crt
 * - http://crt.sectigo.com/SectigoPublicServerAuthenticationCAOVR36.crt
 */
const CONNECTICUT_INTERMEDIATE = `-----BEGIN CERTIFICATE-----
MIIE0DCCA7igAwIBAgIBBzANBgkqhkiG9w0BAQsFADCBgzELMAkGA1UEBhMCVVMx
EDAOBgNVBAgTB0FyaXpvbmExEzARBgNVBAcTClNjb3R0c2RhbGUxGjAYBgNVBAoT
EUdvRGFkZHkuY29tLCBJbmMuMTEwLwYDVQQDEyhHbyBEYWRkeSBSb290IENlcnRp
ZmljYXRlIEF1dGhvcml0eSAtIEcyMB4XDTExMDUwMzA3MDAwMFoXDTMxMDUwMzA3
MDAwMFowgbQxCzAJBgNVBAYTAlVTMRAwDgYDVQQIEwdBcml6b25hMRMwEQYDVQQH
EwpTY290dHNkYWxlMRowGAYDVQQKExFHb0RhZGR5LmNvbSwgSW5jLjEtMCsGA1UE
CxMkaHR0cDovL2NlcnRzLmdvZGFkZHkuY29tL3JlcG9zaXRvcnkvMTMwMQYDVQQD
EypHbyBEYWRkeSBTZWN1cmUgQ2VydGlmaWNhdGUgQXV0aG9yaXR5IC0gRzIwggEi
MA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC54MsQ1K92vdSTYuswZLiBCGzD
BNliF44v/z5lz4/OYuY8UhzaFkVLVat4a2ODYpDOD2lsmcgaFItMzEUz6ojcnqOv
K/6AYZ15V8TPLvQ/MDxdR/yaFrzDN5ZBUY4RS1T4KL7QjL7wMDge87Am+GZHY23e
cSZHjzhHU9FGHbTj3ADqRay9vHHZqm8A29vNMDp5T19MR/gd71vCxJ1gO7GyQ5HY
pDNO6rPWJ0+tJYqlxvTV0KaudAVkV4i1RFXULSo6Pvi4vekyCgKUZMQWOlDxSq7n
eTOvDCAHf+jfBDnCaQJsY1L6d8EbyHSHyLmTGFBUNUtpTrw700kuH9zB0lL7AgMB
AAGjggEaMIIBFjAPBgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBBjAdBgNV
HQ4EFgQUQMK9J47MNIMwojPX+2yz8LQsgM4wHwYDVR0jBBgwFoAUOpqFBxBnKLbv
9r0FQW4gwZTaD94wNAYIKwYBBQUHAQEEKDAmMCQGCCsGAQUFBzABhhhodHRwOi8v
b2NzcC5nb2RhZGR5LmNvbS8wNQYDVR0fBC4wLDAqoCigJoYkaHR0cDovL2NybC5n
b2RhZGR5LmNvbS9nZHJvb3QtZzIuY3JsMEYGA1UdIAQ/MD0wOwYEVR0gADAzMDEG
CCsGAQUFBwIBFiVodHRwczovL2NlcnRzLmdvZGFkZHkuY29tL3JlcG9zaXRvcnkv
MA0GCSqGSIb3DQEBCwUAA4IBAQAIfmyTEMg4uJapkEv/oV9PBO9sPpyIBslQj6Zz
91cxG7685C/b+LrTW+C05+Z5Yg4MotdqY3MxtfWoSKQ7CC2iXZDXtHwlTxFWMMS2
RJ17LJ3lXubvDGGqv+QqG+6EnriDfcFDzkSnE3ANkR/0yBOtg2DZ2HKocyQetawi
DsoXiWJYRBuriSUBAA/NxBti21G00w9RKpv0vHP8ds42pM3Z2Czqrpv1KrKQ0U11
GIo/ikGQI31bS/6kA1ibRrLDYGCD+H1QQc7CoZDDu+8CL9IVVO5EFdkKrqeKM+2x
LXY2JtwE65/3YR8V3Idv7kaWKK2hJn0KCacuBKONvPi8BDAB
-----END CERTIFICATE-----`

const GLOBALSIGN_RSA_OV_SSL_2018_INTERMEDIATE = `-----BEGIN CERTIFICATE-----
MIIETjCCAzagAwIBAgINAe5fIh38YjvUMzqFVzANBgkqhkiG9w0BAQsFADBMMSAw
HgYDVQQLExdHbG9iYWxTaWduIFJvb3QgQ0EgLSBSMzETMBEGA1UEChMKR2xvYmFs
U2lnbjETMBEGA1UEAxMKR2xvYmFsU2lnbjAeFw0xODExMjEwMDAwMDBaFw0yODEx
MjEwMDAwMDBaMFAxCzAJBgNVBAYTAkJFMRkwFwYDVQQKExBHbG9iYWxTaWduIG52
LXNhMSYwJAYDVQQDEx1HbG9iYWxTaWduIFJTQSBPViBTU0wgQ0EgMjAxODCCASIw
DQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKdaydUMGCEAI9WXD+uu3Vxoa2uP
UGATeoHLl+6OimGUSyZ59gSnKvuk2la77qCk8HuKf1UfR5NhDW5xUTolJAgvjOH3
idaSz6+zpz8w7bXfIa7+9UQX/dhj2S/TgVprX9NHsKzyqzskeU8fxy7quRU6fBhM
abO1IFkJXinDY+YuRluqlJBJDrnw9UqhCS98NE3QvADFBlV5Bs6i0BDxSEPouVq1
lVW9MdIbPYa+oewNEtssmSStR8JvA+Z6cLVwzM0nLKWMjsIYPJLJLnNvBhBWk0Cq
o8VS++XFBdZpaFwGue5RieGKDkFNm5KQConpFmvv73W+eka440eKHRwup08CAwEA
AaOCASkwggElMA4GA1UdDwEB/wQEAwIBhjASBgNVHRMBAf8ECDAGAQH/AgEAMB0G
A1UdDgQWBBT473/yzXhnqN5vjySNiPGHAwKz6zAfBgNVHSMEGDAWgBSP8Et/qC5F
JK5NUPpjmove4t0bvDA+BggrBgEFBQcBAQQyMDAwLgYIKwYBBQUHMAGGImh0dHA6
Ly9vY3NwMi5nbG9iYWxzaWduLmNvbS9yb290cjMwNgYDVR0fBC8wLTAroCmgJ4Yl
aHR0cDovL2NybC5nbG9iYWxzaWduLmNvbS9yb290LXIzLmNybDBHBgNVHSAEQDA+
MDwGBFUdIAAwNDAyBggrBgEFBQcCARYmaHR0cHM6Ly93d3cuZ2xvYmFsc2lnbi5j
b20vcmVwb3NpdG9yeS8wDQYJKoZIhvcNAQELBQADggEBAJmQyC1fQorUC2bbmANz
EdSIhlIoU4r7rd/9c446ZwTbw1MUcBQJfMPg+NccmBqixD7b6QDjynCy8SIwIVbb
0615XoFYC20UgDX1b10d65pHBf9ZjQCxQNqQmJYaumxtf4z1s4DfjGRzNpZ5eWl0
6r/4ngGPoJVpjemEuunl1Ig423g7mNA2eymw0lIYkN5SQwCuaifIFJ6GlazhgDEw
fpolu4usBCOmmQDo8dIm7A9+O4orkjgTHY+GzYZSR+Y0fFukAj6KYXwidlNalFMz
hriSqHKvoflShx8xpfywgVcvzfTO3PYkz6fiNJBonf6q8amaEsybwMbDqKWwIX7e
SPY=
-----END CERTIFICATE-----`

const DIGICERT_GLOBAL_G2_TLS_RSA_SHA256_2020_CA1_INTERMEDIATE = `-----BEGIN CERTIFICATE-----
MIIEyDCCA7CgAwIBAgIQDPW9BitWAvR6uFAsI8zwZjANBgkqhkiG9w0BAQsFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBH
MjAeFw0yMTAzMzAwMDAwMDBaFw0zMTAzMjkyMzU5NTlaMFkxCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxMzAxBgNVBAMTKkRpZ2lDZXJ0IEdsb2Jh
bCBHMiBUTFMgUlNBIFNIQTI1NiAyMDIwIENBMTCCASIwDQYJKoZIhvcNAQEBBQAD
ggEPADCCAQoCggEBAMz3EGJPprtjb+2QUlbFbSd7ehJWivH0+dbn4Y+9lavyYEEV
cNsSAPonCrVXOFt9slGTcZUOakGUWzUb+nv6u8W+JDD+Vu/E832X4xT1FE3LpxDy
FuqrIvAxIhFhaZAmunjZlx/jfWardUSVc8is/+9dCopZQ+GssjoP80j812s3wWPc
3kbW20X+fSP9kOhRBx5Ro1/tSUZUfyyIxfQTnJcVPAPooTncaQwywa8WV0yUR0J8
osicfebUTVSvQpmowQTCd5zWSOTOEeAqgJnwQ3DPP3Zr0UxJqyRewg2C/Uaoq2yT
zGJSQnWS+Jr6Xl6ysGHlHx+5fwmY6D36g39HaaECAwEAAaOCAYIwggF+MBIGA1Ud
EwEB/wQIMAYBAf8CAQAwHQYDVR0OBBYEFHSFgMBmx9833s+9KTeqAx2+7c0XMB8G
A1UdIwQYMBaAFE4iVCAYlebjbuYP+vq5Eu0GF485MA4GA1UdDwEB/wQEAwIBhjAd
BgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwdgYIKwYBBQUHAQEEajBoMCQG
CCsGAQUFBzABhhhodHRwOi8vb2NzcC5kaWdpY2VydC5jb20wQAYIKwYBBQUHMAKG
NGh0dHA6Ly9jYWNlcnRzLmRpZ2ljZXJ0LmNvbS9EaWdpQ2VydEdsb2JhbFJvb3RH
Mi5jcnQwQgYDVR0fBDswOTA3oDWgM4YxaHR0cDovL2NybDMuZGlnaWNlcnQuY29t
L0RpZ2lDZXJ0R2xvYmFsUm9vdEcyLmNybDA9BgNVHSAENjA0MAsGCWCGSAGG/WwC
ATAHBgVngQwBATAIBgZngQwBAgEwCAYGZ4EMAQICMAgGBmeBDAECAzANBgkqhkiG
9w0BAQsFAAOCAQEAkPFwyyiXaZd8dP3A+iZ7U6utzWX9upwGnIrXWkOH7U1MVl+t
wcW1BSAuWdH/SvWgKtiwla3JLko716f2b4gp/DA/JIS7w7d7kwcsr4drdjPtAFVS
slme5LnQ89/nD/7d+MS5EHKBCQRfz5eeLjJ1js+aWNJXMX43AYGyZm0pGrFmCW3R
bpD0ufovARTFXFZkAdl9h6g4U5+LXUZtXMYnhIHUfoyMo5tS58aI7Dd8KvvwVVo4
chDYABPPTHPbqjc1qCmBaZx2vN4Ye5DUys/vZwP9BFohFrH/6j/f3IL16/RZkiMN
JCqVJUzKoZHm1Lesh3Sz8W2jmdv51b2EQJ8HmA==
-----END CERTIFICATE-----`

const SECTIGO_PUBLIC_SERVER_AUTHENTICATION_CA_OV_R36_INTERMEDIATE = `-----BEGIN CERTIFICATE-----
MIIGTDCCBDSgAwIBAgIQLBo8dulD3d3/GRsxiQrtcTANBgkqhkiG9w0BAQwFADBf
MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD
Ey1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw
HhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY
MBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp
YyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgT1YgUjM2MIIBojANBgkqhkiG9w0B
AQEFAAOCAY8AMIIBigKCAYEApkMtJ3R06jo0fceI0M52B7K+TyMeGcv2BQ5AVc3j
lYt76TvHIu/nNe22W/RJXX9rWUD/2GE6GF5x0V4bsY7K3IeJ8E7+KzG/TGboySfD
u+F52jqQBbY62ofhYjMeiAbLI02+FqwHeM8uIrUtcX8b2RCxF358TB0NHVccAXZc
FYgZndZCeXxjuca7pJJ20LLUnXtgXcjAE1vY4WvbReW0W6mkeZyNGdmpTcFs5Y+s
yy6LtE5Zocji9J9NlNnReox2RWVyEXpA1ChZ4gqN+ZpVSIQ0HBorVFbBKyhdZyEX
gZgNSNtBRwxqwIzJePJhYd4ZUhO1vk+/uP3nwDk0p95q/j7naXNCSvESnrHPypaB
WRK066nKfPRPi9m9kIOhMdYfS8giFRTcdgL24Ycilj7ecAK9Trh0VbjwouJ4WH+x
bt47u68ZFCD/ac55I0DNHkCpaPruj6e9Rmr7K46wZDAYXuEAqB7tGG/jd6JAA+H2
O44CV98NRsU213f1kScIZntNAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk
lfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQU42Z0u3BojSxdTg6mSo+bNyKcgpIw
DgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI
KwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgIw
VAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv
UHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH
AQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp
Z29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF
BzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA
BZXWDHWC3cubb/e1I1kzi8lPFiK/ZUoH09ufmVOrc5ObYH/XKkWUexSPqRkwKFKr
7r8OuG+p7VNB8rifX6uopqKAgsvZtZsq7iAFw04To6vNcxeBt1Eush3cQ4b8nbQR
MQLChgEAqwhuXp9P48T4QEBSksYav7+aFjNySsLYlPzNqVM3RNwvBdvp6vgDtGwc
xlKQZVuuNVIaoYyls8swhxDeSHKpRdxRauTLZ+pl+wGvy0pnrLEJGSz9mOEmfbod
e/XopR2NGqaHJ6bIjyxPu6UtyQGI26En7UAEozACrHz06Nx2jTAY9E6NeB6XuobE
wLK025ZRmvglcURG1BrV24tGHHTgxCe8M3oGlpUSMTKQ2dkgljZVYt+gKdFtWELZ
MuRdi+X3XsrR8LFz+aLUiDRfQqhmw3RxjIyVKvvu9UPYY1nsvxYmFnUSeM+2q1z/
iPUry+xDY9MC6+IhleKT094VKdFVp7LXH42+wvU+17lRolQ2mK2N/nBLVBwaIhib
QXw4VYKwB86Bc6eS6iqsc94KEgD/U4VsjmgfhK+Xp4NM+VYzTTa3QeV3p8xOM0cw
q1p8oZFA+OBcz3FYWpDIe5j0NWKlw9hXsTyPY/HeZUV59akskSOSRSmDfe8wJDPX
58uB9/7lud0G3x0pxQAcffP0ayKavNwDTw4UfJ34cEw=
-----END CERTIFICATE-----`

const trustedIntermediates = new Map([
  ["www.cga.ct.gov", CONNECTICUT_INTERMEDIATE],
  ["billstatus.ls.state.ms.us", GLOBALSIGN_RSA_OV_SSL_2018_INTERMEDIATE],
  ["legislature.vermont.gov", GLOBALSIGN_RSA_OV_SSL_2018_INTERMEDIATE],
  ["legislature.mi.gov", DIGICERT_GLOBAL_G2_TLS_RSA_SHA256_2020_CA1_INTERMEDIATE],
  ["www.legislature.mi.gov", DIGICERT_GLOBAL_G2_TLS_RSA_SHA256_2020_CA1_INTERMEDIATE],
  ["www.legislature.ohio.gov", SECTIGO_PUBLIC_SERVER_AUTHENTICATION_CA_OV_R36_INTERMEDIATE]
])
const freshConnectionHosts = new Set(["gc.nh.gov", "www.gencourt.state.nh.us"])
const agents = new Map<string, HttpsAgent>()
const MAXIMUM_TRUSTED_DOCUMENT_REDIRECTS = 5
const DOCUMENT_FETCH_RELAY_HEADER = "x-legislation-relayed-source"
const RELAYED_DOCUMENT_PATH = /^\/legislation\/bills\/text\/(?:DOC|HTM|PDF)\/[0-9]{4}\/[0-9]+\/[A-Z0-9]+\/PN[0-9]+$/
const RELAYED_PENNSYLVANIA_AMENDMENT_PATH = /^\/legislation\/amendments\/text\/[0-9]{4}\/[0-9]+\/A[0-9]+$/
const RELAYED_PENNSYLVANIA_FISCAL_NOTE_PATH = /^\/WU01\/LI\/BI\/(?:FN|SFN)\/[0-9]{4}\/[0-9]+\/[A-Z0-9]+P[0-9]+\.pdf$/i

export function usesTrustedDocumentTransport(url: URL): boolean {
  return url.protocol === "https:" && trustedIntermediates.has(url.hostname.toLowerCase())
}

/**
 * New Hampshire's legacy archive closes persistent sockets without reliably
 * advertising that behavior. Undici can then reuse a socket the publisher has
 * already closed, producing `UND_ERR_SOCKET: other side closed`. Use a fresh
 * normally validated TLS connection for only the two official NH hosts.
 */
export function usesFreshConnectionDocumentTransport(url: URL): boolean {
  return url.protocol === "https:" && freshConnectionHosts.has(url.hostname.toLowerCase())
}

export function isApprovedDocumentRelayUrl(url: URL): boolean {
  const pennsylvaniaAmendmentQueryApproved =
    url.search.length === 0 ||
    (url.searchParams.size === 1 && /^(?:DOC|HTM|PDF)$/.test(url.searchParams.get("txtType") ?? ""))
  return (
    url.protocol === "https:" &&
    url.username.length === 0 &&
    url.password.length === 0 &&
    url.hash.length === 0 &&
    ((url.hostname.toLowerCase() === "www.palegis.us" &&
      ((url.search.length === 0 && RELAYED_DOCUMENT_PATH.test(url.pathname)) ||
        (RELAYED_PENNSYLVANIA_AMENDMENT_PATH.test(url.pathname) && pennsylvaniaAmendmentQueryApproved))) ||
      (url.hostname.toLowerCase() === "www.legis.state.pa.us" &&
        url.search.length === 0 &&
        RELAYED_PENNSYLVANIA_FISCAL_NOTE_PATH.test(url.pathname)))
  )
}

export function relayedDocumentSource(response: Response): URL | undefined {
  const value = response.headers.get(DOCUMENT_FETCH_RELAY_HEADER)
  if (value === null) {
    return undefined
  }
  try {
    const url = new URL(value)
    return isApprovedDocumentRelayUrl(url) ? url : undefined
  } catch {
    return undefined
  }
}

/**
 * Uses Node's default transport for every other destination. For each
 * explicitly observed incomplete chain, it retains the default roots and adds
 * only the public issuer certificate required to complete validation.
 */
export async function fetchDocumentWithTrustedIntermediates(url: URL, init: RequestInit): Promise<Response> {
  return await fetchDocumentWithTrustedIntermediatesAtRedirect(url, init, 0)
}

async function fetchDocumentWithTrustedIntermediatesAtRedirect(
  url: URL,
  init: RequestInit,
  redirectCount: number
): Promise<Response> {
  const relayUrl = process.env.DOCUMENT_FETCH_RELAY_URL?.trim()
  const relayToken = process.env.DOCUMENT_FETCH_RELAY_TOKEN?.trim()
  if (
    relayUrl !== undefined &&
    relayToken !== undefined &&
    isApprovedDocumentRelayUrl(url) &&
    (init.method === undefined || init.method === "GET")
  ) {
    return await fetch(relayUrl, {
      body: JSON.stringify({ sourceUrl: url.href }),
      headers: {
        authorization: `Bearer ${relayToken}`,
        "content-type": "application/json"
      },
      method: "POST",
      signal: init.signal
    })
  }
  const intermediate = trustedIntermediates.get(url.hostname.toLowerCase())
  let response: Response
  if (usesFreshConnectionDocumentTransport(url)) {
    response = await fetchHttpsWithAgent(url, { ...init, redirect: "manual" }, false)
  } else if (url.protocol === "https:" && intermediate !== undefined) {
    response = await fetchHttpsWithTrustedIntermediate(url, { ...init, redirect: "manual" }, intermediate)
  } else {
    response = await fetch(url, { ...init, redirect: "manual" })
  }
  if (![301, 302, 303, 307, 308].includes(response.status)) {
    return response
  }
  if (init.redirect === "manual") {
    return response
  }
  if (init.redirect === "error") {
    await response.body?.cancel()
    throw new TypeError("Document redirect is not allowed")
  }
  const location = response.headers.get("location")
  if (location === null) {
    return response
  }
  if (redirectCount >= MAXIMUM_TRUSTED_DOCUMENT_REDIRECTS) {
    await response.body?.cancel()
    throw new TypeError("Document redirect limit exceeded")
  }
  const redirectedUrl = new URL(location, url)
  if (redirectedUrl.protocol !== "https:") {
    await response.body?.cancel()
    throw new TypeError("Document redirect changed to an unsupported protocol")
  }
  await response.body?.cancel()
  const redirectedHeaders = new Headers(init.headers)
  if (redirectedUrl.origin !== url.origin) {
    redirectedHeaders.delete("authorization")
    redirectedHeaders.delete("cookie")
    redirectedHeaders.delete("proxy-authorization")
  }
  const switchToGet =
    response.status === 303 || ((response.status === 301 || response.status === 302) && init.method === "POST")
  return await fetchDocumentWithTrustedIntermediatesAtRedirect(
    redirectedUrl,
    {
      ...init,
      body: switchToGet ? undefined : init.body,
      headers: redirectedHeaders,
      method: switchToGet ? "GET" : init.method,
      redirect: "follow"
    },
    redirectCount + 1
  )
}

function agentFor(host: string, intermediate: string): HttpsAgent {
  const existing = agents.get(host)
  if (existing !== undefined) {
    return existing
  }
  const agent = new HttpsAgent({
    ca: [...rootCertificates, intermediate],
    keepAlive: true
  })
  agents.set(host, agent)
  return agent
}

async function fetchHttpsWithTrustedIntermediate(url: URL, init: RequestInit, intermediate: string): Promise<Response> {
  return await fetchHttpsWithAgent(url, init, agentFor(url.hostname.toLowerCase(), intermediate))
}

async function fetchHttpsWithAgent(url: URL, init: RequestInit, agent: HttpsAgent | false): Promise<Response> {
  const headers = new Headers(init.headers)
  return await new Promise<Response>((resolve, reject) => {
    const request = httpsRequest(url, {
      agent,
      headers: Object.fromEntries(headers.entries()),
      method: init.method ?? "GET",
      signal: init.signal ?? undefined
    })
    request.once("error", reject)
    request.once("response", (response) => {
      const responseHeaders = new Headers()
      for (const [name, value] of Object.entries(response.headers)) {
        if (value === undefined) {
          continue
        }
        for (const entry of Array.isArray(value) ? value : [value]) {
          responseHeaders.append(name, entry)
        }
      }
      resolve(
        new Response(Readable.toWeb(response) as ReadableStream<Uint8Array>, {
          headers: responseHeaders,
          status: response.statusCode ?? 200,
          statusText: response.statusMessage ?? ""
        })
      )
    })
    writeRequestBody(request, init.body)
  })
}

function writeRequestBody(request: ReturnType<typeof httpsRequest>, body: RequestInit["body"]) {
  if (body === undefined || body === null) {
    request.end()
    return
  }
  if (typeof body === "string" || body instanceof Uint8Array) {
    request.end(body)
    return
  }
  if (body instanceof URLSearchParams) {
    request.end(body.toString())
    return
  }
  request.destroy(
    new TypeError("Trusted document transport supports only string, URLSearchParams, and Uint8Array bodies")
  )
}
