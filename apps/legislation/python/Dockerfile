# Local acceptance image. Production orchestration remains Trigger.dev.
FROM python@sha256:9534e5a8e315485d4061ed659af0fd78a284c015f9b73661b41d6bab25604534
ARG SOURCE_INPUTS=artifacts/openstates-runtime/clock-corrected-build-inputs
ARG DEPENDENCY_INPUTS=artifacts/openstates-runtime/clock-corrected-dependency-inputs
ARG APPROVED_PYTHON_INDEX
COPY python/*.py /opt/openstates/adapter/
COPY ${SOURCE_INPUTS}/ /opt/openstates/inputs/
COPY ${DEPENDENCY_INPUTS}/ /opt/openstates/dependencies/
WORKDIR /opt/openstates/dependencies
RUN test -n "$APPROVED_PYTHON_INDEX" && \
    python /opt/openstates/adapter/prepare_openstates_dependencies.py --verify /opt/openstates/inputs /opt/openstates/dependencies && \
    PIP_INDEX_URL="$APPROVED_PYTHON_INDEX" python -m pip install --require-hashes --no-cache-dir -r bootstrap.txt && \
    PIP_INDEX_URL="$APPROVED_PYTHON_INDEX" python -m pip install --require-hashes --no-build-isolation --no-cache-dir -r requirements.txt && \
    python -m pip check
ENV PYTHONDONTWRITEBYTECODE=1
WORKDIR /tmp
CMD ["python", "/opt/openstates/adapter/smoke_openstates_runtime.py", "/opt/openstates/inputs"]
