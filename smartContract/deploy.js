async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy TFHEExecutor
  const TFHEExecutorFactory = await ethers.getContractFactory("TFHEExecutor");
  const tfheExecutor = await TFHEExecutorFactory.deploy();
  await tfheExecutor.deployed();
  console.log("TFHEExecutor deployed to:", tfheExecutor.address);

  // Deploy ACL
  const ACLFactory = await ethers.getContractFactory("ACL");
  const acl = await ACLFactory.deploy();
  await acl.deployed();
  console.log("ACL deployed to:", acl.address);

  // Deploy KMSVerifier
  const KMSVerifierFactory = await ethers.getContractFactory("KMSVerifier");
  const kmsVerifier = await KMSVerifierFactory.deploy();
  await kmsVerifier.deployed();
  console.log("KMSVerifier deployed to:", kmsVerifier.address);

  // Deploy InputVerifier
  const InputVerifierFactory = await ethers.getContractFactory("InputVerifier");
  const inputVerifier = await InputVerifierFactory.deploy();
  await inputVerifier.deployed();
  console.log("InputVerifier deployed to:", inputVerifier.address);

  // Deploy ConfidentialSettlement with the addresses of the above contracts
  const ConfidentialSettlementFactory = await ethers.getContractFactory("ConfidentialSettlement");
  const confidentialSettlement = await ConfidentialSettlementFactory.deploy(
    acl.address,
    tfheExecutor.address,
    kmsVerifier.address,
    inputVerifier.address
  );
  await confidentialSettlement.deployed();
  console.log("ConfidentialSettlement deployed to:", confidentialSettlement.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });