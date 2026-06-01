import "server-only";

/**
 * IPFS DIRECTORY pinning for drops (Pinata).
 *
 * Pinata's `pinFileToIPFS` accepts a MULTI-FILE multipart form where every part
 * shares a common top-level directory in its `filepath`. Pinata wraps them into
 * one UnixFS directory and returns the DIRECTORY CID. Resolving
 * `https://gateway/ipfs/<dirCID>/<name>` then returns the individual file. This
 * is exactly what a drop needs: `tokenURI = baseURI + id` where
 * `baseURI = ipfs://<metadataDirCID>/` resolves `ipfs://<metadataDirCID>/1`.
 *
 * The per-file form-part name is "file" and the filepath is
 * "<dir>/<filename>" (Pinata reads the directory from the path prefix).
 *
 * SCALE CAVEAT (flagged in the report): a single serverless invocation cannot
 * reliably stream thousands of files to Pinata within the function timeout /
 * memory. The job layer (see /api/drops/process) therefore processes in CHUNKS
 * and is poll-based. This function pins ONE chunk (a slice of the directory).
 * For a one-shot directory CID across chunks you need either (a) a Pinata
 * paid plan with the CAR upload endpoint, or (b) a pinning queue. See
 * `pinDirectoryChunked` notes and the TODO in /api/drops/process.
 */

export interface DirFile {
  /** File name within the directory (e.g. "1", "1.png"). */
  name: string;
  bytes: Uint8Array;
  contentType?: string;
}

export interface PinDirResult {
  ok: boolean;
  /** Directory CID (UnixFS dir). baseURI = `ipfs://<cid>/`. */
  cid?: string;
  /** Gateway URL for the directory. */
  gateway?: string;
  count: number;
  error?: string;
}

const PINATA_PIN_FILE = "https://api.pinata.cloud/pinning/pinFileToIPFS";

/**
 * Pin a set of files as ONE IPFS directory via Pinata. Returns the directory
 * CID. All files are sent in a single multipart request sharing the directory
 * name `dirName` as their path prefix.
 *
 * NOTE: this issues a single request. For very large directories the caller
 * MUST chunk (see /api/drops/process) — Pinata + serverless limits make a
 * single multi-thousand-file request unreliable.
 */
export async function pinDirectory(
  dirName: string,
  files: DirFile[],
  jwt: string | undefined,
  gatewayBase: string,
): Promise<PinDirResult> {
  if (!jwt) return { ok: false, count: 0, error: "PINATA_JWT not set" };
  if (files.length === 0) return { ok: false, count: 0, error: "no files to pin" };

  try {
    const fd = new FormData();
    for (const f of files) {
      const blob = new Blob([f.bytes as BlobPart], {
        type: f.contentType || "application/octet-stream",
      });
      // The directory is derived from the path prefix on each part.
      fd.append("file", blob, `${dirName}/${f.name}`);
    }
    fd.append(
      "pinataOptions",
      JSON.stringify({ wrapWithDirectory: false, cidVersion: 1 }),
    );
    fd.append("pinataMetadata", JSON.stringify({ name: dirName }));

    const res = await fetch(PINATA_PIN_FILE, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, count: 0, error: `pin failed ${res.status}: ${text.slice(0, 200)}` };
    }
    const json = (await res.json()) as { IpfsHash: string };
    const cid = json.IpfsHash;
    const gw = gatewayBase.replace(/\/$/, "");
    return { ok: true, cid, gateway: `${gw}/${cid}`, count: files.length };
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "pin error" };
  }
}
