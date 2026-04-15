# Embedding-modell: kilde og attribusjon

Bedrifts-AI i `ai-service` bruker en **forhåndstrent** modell lastet inn av biblioteket **sentence-transformers**. Ved første kjøring (eller etter cache-sletting) lastes modellfilene ned fra **Hugging Face Hub** til lokal maskin/cache.

## Hvilken modell (standard i koden)

| Felt | Verdi |
|------|--------|
| **Miljøvariabel** | `EMBED_MODEL` (valgfri; hvis utelatt brukes standard under) |
| **Standard-ID** | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| **Definert i** | `ai-service/main.py` (`MODEL_NAME`) |

**Modellsiden (offisiell kilde, lisens og sitat):**  
https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2

Endrer dere `EMBED_MODEL` til en annen modell, oppdater denne filen og eventuell tekst på nettsiden tilsvarende.

## Lisens

Ifølge modellsiden på Hugging Face er modellen merket med **Apache License 2.0** (`license:apache-2.0`). Full lisenstekst: https://www.apache.org/licenses/LICENSE-2.0  

Følg Apache 2.0-kravene (f.eks. ved videre distribusjon av avledede verk). Ved tvil: juridisk vurdering.

## Opphav og vitenskapelig referanse

Modellkortet oppgir at modellen er trent i **sentence-transformers**-økosystemet og viser til artikkelen *Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks* (Reimers & Gurevych, EMNLP 2019).

- **arXiv:** https://arxiv.org/abs/1908.10084  
- **sentence-transformers:** https://www.sbert.net/

BibTeX (fra modellkortet):

```bibtex
@inproceedings{reimers-2019-sentence-bert,
    title = {Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks},
    author = {Reimers, Nils and Gurevych, Iryna},
    booktitle = {Proceedings of the 2019 Conference on Empirical Methods in Natural Language Processing},
    month = {11},
    year = {2019},
    publisher = {Association for Computational Linguistics},
    url = {http://arxiv.org/abs/1908.10084},
}
```

## Forslag til kort tekst (nettside / credits)

> Embedding for bedrifts-AI bruker modellen *paraphrase-multilingual-MiniLM-L12-v2* fra [sentence-transformers på Hugging Face](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2), lisensiert under Apache 2.0. Metodikk beskrevet i Reimers & Gurevych (2019), [Sentence-BERT](https://arxiv.org/abs/1908.10084).

Tilpass språk og plassering (f.eks. underside «Om oss», vilkår eller teknisk dokumentasjon) etter behov.
