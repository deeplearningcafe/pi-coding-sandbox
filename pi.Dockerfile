FROM node:22-slim

RUN apt-get update && apt-get install -y \
    git python3 python3-pip curl build-essential ca-certificates \
    ripgrep fd-find unzip make \
    ffmpeg libavcodec-dev libavformat-dev libavutil-dev libswscale-dev libswresample-dev \
    && rm -rf /var/lib/apt/lists/*

RUN ln -s /usr/bin/fdfind /usr/local/bin/fd

RUN curl -LO https://github.com/neovim/neovim/releases/latest/download/nvim-linux-x86_64.tar.gz \
    && tar -C /usr/local --strip-components 1 -xzf nvim-linux-x86_64.tar.gz \
    && rm nvim-linux-x86_64.tar.gz

RUN npm install -g prettier eslint
RUN pip3 install --break-system-packages ruff pyright

# Install Pi globally (accessible system-wide)
RUN npm install -g @earendil-works/pi-coding-agent

# Install uv system-wide as root under /usr/local/bin
ADD https://astral.sh/uv/install.sh /install.sh
RUN chmod +x /install.sh && env UV_UNMANAGED_INSTALL="/usr/local/bin" /install.sh && rm /install.sh

# Create a dedicated sandbox user with ID 5000
RUN groupadd -g 5000 pisandbox && \
    useradd -l -u 5000 -g pisandbox -m pisandbox

# Pre-create internal user directories as the sandbox user
RUN mkdir -p /home/pisandbox/.local/share \
             /home/pisandbox/.local/state \
             /home/pisandbox/.cache \
    && chown -R pisandbox:pisandbox /home/pisandbox

USER pisandbox
ENV PATH="/home/pisandbox/.local/bin:${PATH}"
WORKDIR /home/pisandbox/project

RUN mkdir -p /home/pisandbox/.pi/agent

ENTRYPOINT ["pi"]
