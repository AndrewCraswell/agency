# Pinned embedding vocabularies

Voyage files are redistributed from `voyageai/voyage-4` revision `44f3b2ae4ddf33403ed4dd66bec3fa48ff7dbbf9` (Apache-2.0,
publisher model metadata). They contain vocabulary/configuration only, no inference weights. Runtime loading never
contacts Hugging Face.

| File                             | Original SHA-256                                                   |
| -------------------------------- | ------------------------------------------------------------------ |
| `voyage-4-tokenizer.json`        | `c0382117ea329cdf097041132f6d735924b697924d6f6fc3945713e96ce87539` |
| `voyage-4-tokenizer_config.json` | `58c4abbc36eeccd8b3c8453f262225e8f2803855c88790760b618f4cd9e43be9` |

Sources: https://huggingface.co/voyageai/voyage-4/tree/44f3b2ae4ddf33403ed4dd66bec3fa48ff7dbbf9 and
https://docs.voyageai.com/docs/tokenization . Runtime checks bind canonical JSON hashes so bundlers may serialize JSON
without changing its meaning. OpenAI's `cl100k_base` comes from pinned `tiktoken@1.0.22`; its canonical vocabulary hash
is checked in the shared loader. Both paths preserve original strings when preparing passages; tokenizer normalization
is used only to count the text as that model sees it.
