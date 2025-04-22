{
  description = "Homina dev shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = nixpkgs.legacyPackages.${system}; in
      {
        devShell = pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs
            pkgs.bun
            pkgs.postgresql
          ];

          shellHook = ''
            echo "Entering Homina dev shell…"
            export BOT_TOKEN?=""
            export CLIENT_ID?=""
            export GUILD_ID?=""
            export DB_NAME?=""
            export DB_USER?=""
            export DB_PWD?=""
          '';
        };
      }
    );
}