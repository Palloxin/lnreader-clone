<View style={styles.btnContainer}>
          <Button
            title={getString(isEditMode ? "common.ok" : "common.add")}
            onPress={async () => {
              if (
                !new RegExp(/https?:\/\/(.*?)plugins\.min\.json/).test(
                  repositoryUrl
                )
              ) {
                showToast("Repository URL is invalid");
                return;
              }

              if (await isRepoUrlDuplicate(repositoryUrl)) {
                showToast("A respository with this url already exists!");
              } else {
                if (isEditMode && repository) {
                  updateRepository(repository?.id, repositoryUrl);
                } else {
                  createRepository(repositoryUrl);
                }
                onSuccess();
              }
              setRepositoryUrl("");
              closeModal();
            }}
          />
          <Button title={getString("common.cancel")} onPress={closeModal} />
        </View>
