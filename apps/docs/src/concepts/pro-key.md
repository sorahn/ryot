# Feature Availability in This Fork

This modified GPLv3 fork enables the existing self-hosted Pro features by default.
No license key, subscription, or Unkey connectivity is required. A configured
`SERVER_PRO_KEY` is ignored; it can be removed from your environment.

Some features still require their normal configuration:

- Metadata providers may require your own API credentials.
- File attachments and exports require [file storage](../guides/file-storage.md).
- Email delivery requires SMTP configuration.

Account authentication, ownership restrictions, and administrator permissions
remain enforced. This fork does not include the upstream hosted service or support.

The fork accepts upstream changes only while licensing remains unchanged from its
GPL baseline. It will remain on that codebase when upstream changes license.
See [the fork maintenance guide](https://github.com/sorahn/ryot/blob/main/FORK.md).
