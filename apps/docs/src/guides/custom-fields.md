# Custom fields

This fork supports personal custom fields on every media type. There are no
game-specific fields: you choose the names, types, and applicable media types.

## Define fields

Open **Settings → Custom fields** and create a field. Available types are text,
number, checkbox, date, single choice, and multiple choices. Choice fields take
one option per line. Leave **Media types** empty to apply a field to all media,
or select the types you want. A definition can apply to several types at once.

For example, a personal priority, loan date, or recommendation note can work for
books, films, music, or games using the same field definition.

Definitions and values belong to your account. Other users cannot read or modify
them. Renaming a field preserves its values. Changes to its type, choices, or
media scope are rejected when existing values would become invalid. Update or
clear those values first. Deleting a field deletes its values after confirmation.

## Edit values

Open a media item's **Custom fields** tab. Fill in the fields and select **Save
fields**. **Clear** removes a value; zero, false, and an empty text string are
valid values and are distinct from an unset value.

Values are separate from provider metadata and survive catalog refreshes. They
also survive removing an item from your tracked library. Cleanup retains catalog
items that still have annotations. Merging items moves your annotations to the
target; conflicting values must be resolved first. Another user's annotations
are not moved by your merge.

## Export and import

In **Settings → Custom fields**, use **Export fields and values** to download a
JSON file containing all your definitions and values, including annotations on
untracked items. This download is separate from Ryot's existing media export and
does not require S3. Back up the entire PostgreSQL database for complete recovery.

Use **Import fields and values** to restore or transfer them. Catalog items must
already exist with matching media type, provider, and provider identifier. For
custom catalog entries, preserve their identifiers. This file does not create
catalog records.

Import merges definitions by name. Existing definitions must have the same type,
choices, and media scope. Matching values are replaced by values from the file;
unmentioned values remain intact. IDs are remapped to the importing account, so
another user's definitions cannot be overwritten. If any entry is missing,
ambiguous, or invalid, the entire import is rejected without partial changes.

Library filtering and sorting by custom values are not yet part of this first
version. Existing Game Shelf data is not imported automatically.
